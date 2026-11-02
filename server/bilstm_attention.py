"""
KSL 수어 인식 모델
Bi-LSTM + Temporal Attention

입력 shape : (batch, 30, 225)
Feature 구조: [Left Hand(63) | Right Hand(63) | Pose(99)] = 225 dim
출력        : softmax(num_classes)
"""

import tensorflow as tf
from tensorflow.keras import layers, Model, regularizers


# ═══════════════════════════════════════════════════════════════
# 현재 프로젝트 기준 고정값
# ═══════════════════════════════════════════════════════════════

SEQ_LEN     = 30
FEATURE_DIM = 225


# ═══════════════════════════════════════════════════════════════
# Temporal Attention Layer
# ═══════════════════════════════════════════════════════════════

class TemporalAttention(layers.Layer):
    """
    시간축 Additive Attention (Bahdanau 스타일)

    입력  : (B, T, H)
    출력  : context (B, H),  weights (B, T)

    수식
    ----
    e_t = v · tanh(W · h_t + b)
    α_t = softmax(e_t)
    c   = Σ α_t · h_t
    """

    def __init__(self, units=64, **kwargs):
        super().__init__(**kwargs)
        self.units = units
        self.W = layers.Dense(units, activation='tanh', use_bias=True,  name='attn_W')
        self.v = layers.Dense(1,                        use_bias=False, name='attn_v')

    def call(self, hidden_states, training=False):
        energy  = self.v(self.W(hidden_states))          # (B, T, 1)
        energy  = tf.squeeze(energy, axis=-1)            # (B, T)
        weights = tf.nn.softmax(energy, axis=-1)         # (B, T)
        context = tf.einsum('bt,bth->bh', weights, hidden_states)
        return context, weights

    def get_config(self):
        cfg = super().get_config()
        cfg.update({'units': self.units})
        return cfg


# ═══════════════════════════════════════════════════════════════
# 모델 생성
# ═══════════════════════════════════════════════════════════════

def build_model(
        input_dim=FEATURE_DIM,
        num_classes=None,
        seq_len=SEQ_LEN,
        lstm_units=64,
        dense_units=64,
        dropout_rate=0.4,
        recurrent_dropout=0.2,
        l2_lambda=1e-4,
):
    """
    Bi-LSTM + Temporal Attention 모델 생성

    레이어 이름 (inference.py 의 get_layer() 와 반드시 일치)
    ──────────────────────────────────────────────────────────
    input_bn          BatchNorm (입력)
    feature_proj      Dense 압축
    proj_bn           BatchNorm (압축 후)
    proj_dropout      Dropout
    bilstm_1          Bidirectional LSTM 1
    bilstm1_dropout   Dropout
    bilstm_2          Bidirectional LSTM 2
    temporal_attention  TemporalAttention   ← inference.py 와 동일하게 고정
    context_bn        BatchNorm (context)
    dense_1           Dense 분류 헤드
    cls_dropout       Dropout
    predictions       Dense softmax 출력
    """

    if num_classes is None:
        raise ValueError("num_classes 를 반드시 지정해야 합니다.")

    reg = regularizers.l2(l2_lambda)

    # ── 입력 ────────────────────────────────────────────────────
    inputs = layers.Input(shape=(seq_len, input_dim), name='keypoints')

    # ── 입력 정규화 ─────────────────────────────────────────────
    x = layers.BatchNormalization(name='input_bn')(inputs)
    x = layers.GaussianNoise(0.01, name='input_noise')(x)

    # ── 피처 압축 ───────────────────────────────────────────────
    x = layers.Dense(lstm_units * 2, activation='relu',
                     kernel_regularizer=reg, name='feature_proj')(x)
    x = layers.BatchNormalization(name='proj_bn')(x)
    x = layers.SpatialDropout1D(dropout_rate * 0.5, name='proj_dropout')(x)

    # ── Bi-LSTM 1 ───────────────────────────────────────────────
    x = layers.Bidirectional(
        layers.LSTM(lstm_units,
                    return_sequences=True,
                    dropout=dropout_rate,
                    recurrent_dropout=recurrent_dropout,
                    kernel_regularizer=reg,
                    recurrent_regularizer=reg),
        merge_mode='concat',
        name='bilstm_1'
    )(x)
    x = layers.Dropout(dropout_rate, name='bilstm1_dropout')(x)

    # ── Bi-LSTM 2 ───────────────────────────────────────────────
    x = layers.Bidirectional(
        layers.LSTM(lstm_units // 2,
                    return_sequences=True,
                    dropout=dropout_rate,
                    recurrent_dropout=recurrent_dropout,
                    kernel_regularizer=reg),
        merge_mode='concat',
        name='bilstm_2'
    )(x)

    # ── Temporal Attention ──────────────────────────────────────
    attn_layer      = TemporalAttention(units=lstm_units // 2,
                                        name='temporal_attention')
    context, _      = attn_layer(x)

    # ── 분류 헤드 ───────────────────────────────────────────────
    x = layers.BatchNormalization(name='context_bn')(context)
    x = layers.Dense(dense_units, activation='relu',
                     kernel_regularizer=reg, name='dense_1')(x)
    x = layers.Dropout(dropout_rate, name='cls_dropout')(x)
    outputs = layers.Dense(num_classes, activation='softmax',
                           name='predictions')(x)

    return Model(inputs=inputs, outputs=outputs, name='KSL_BiLSTM_Attention')


# ═══════════════════════════════════════════════════════════════
# Attention weights 확인용 Debug 모델
# ═══════════════════════════════════════════════════════════════

def build_attention_model(input_dim=FEATURE_DIM, num_classes=None,
                          seq_len=SEQ_LEN, **kwargs):
    """
    main_model 과 동일한 구조에서 attention weights 도 출력하는 debug 모델을 함께 반환합니다.

    Returns
    -------
    main_model  : 일반 추론용
    debug_model : (predictions, attention_weights) 동시 출력
    """
    if num_classes is None:
        raise ValueError("num_classes 를 반드시 지정해야 합니다.")

    main_model = build_model(
        input_dim=input_dim,
        num_classes=num_classes,
        seq_len=seq_len,
        **kwargs
    )

    attn_layer  = main_model.get_layer('temporal_attention')
    debug_model = Model(
        inputs=main_model.input,
        outputs=[main_model.output, attn_layer.output[1]],
        name='KSL_BiLSTM_Attention_Debug'
    )

    return main_model, debug_model


# ═══════════════════════════════════════════════════════════════
# 컴파일 헬퍼
# ═══════════════════════════════════════════════════════════════

@tf.keras.utils.register_keras_serializable(package="KSL")
class FocalLoss(tf.keras.losses.Loss):
    """다중 클래스 분류용 Focal Loss.

    gamma가 클수록 이미 잘 맞히는 쉬운 샘플의 영향은 줄고,
    틀리기 쉬운 샘플에 더 집중합니다.
    """

    def __init__(self, gamma=2.0, label_smoothing=0.1, name="focal_loss"):
        super().__init__(name=name)
        self.gamma = float(gamma)
        self.label_smoothing = float(label_smoothing)

    def call(self, y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)

        # CE 계산에는 label smoothing을 적용합니다.
        ce = tf.keras.losses.categorical_crossentropy(
            y_true,
            y_pred,
            label_smoothing=self.label_smoothing,
        )

        # Focal weight는 원래 one-hot 정답 클래스 확률을 기준으로 계산합니다.
        p_t = tf.reduce_sum(y_true * y_pred, axis=-1)
        focal_weight = tf.pow(1.0 - p_t, self.gamma)

        return focal_weight * ce

    def get_config(self):
        config = super().get_config()
        config.update({
            "gamma": self.gamma,
            "label_smoothing": self.label_smoothing,
        })
        return config

def compile_model(model, num_classes=None, learning_rate=1e-3,
                   label_smoothing=0.1, use_focal=False, focal_gamma=2.0):
    """
    CategoricalCrossentropy(or Focal Loss) + Label Smoothing + Adam 으로 컴파일합니다.
    """
    loss = (
        FocalLoss(
            gamma=focal_gamma,
            label_smoothing=label_smoothing,
        )
        if use_focal
        else tf.keras.losses.CategoricalCrossentropy(
            label_smoothing=label_smoothing
        )
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate),
        loss=loss,
        metrics=[
            'accuracy',
            tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc'),
        ]
    )
    return model