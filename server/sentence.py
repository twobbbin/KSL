# ============================================================
# 수어 단어 배열 → 자연스러운 한국어 문장
# ============================================================


# 동사의 기본적인 문장형
VERB_ENDINGS = {
    "먹다": "먹는다",
    "보다": "본다",
    "만나다": "만난다",
    "타다": "탄다",
    "걷다": "걷는다",
    "도착하다": "도착한다",
    "공부": "공부한다",
    "노력하다": "노력한다",
    "태어나다": "태어난다",
    "원하다": "원한다",
    "잘하다": "잘한다",
    "조심하다": "조심한다",
    "끝나다": "끝난다",
}


# 목적어로 사용하기 쉬운 단어
OBJECT_WORDS = {
    "비빔밥",
    "영화",
    "핸드폰",
    "음식",
    "시험",
}


def has_batchim(word):
    """
    마지막 글자에 받침이 있는지 확인

    예)
    나 -> False
    밥 -> True
    영화 -> False
    """
    if not word:
        return False

    last = word[-1]

    if "가" <= last <= "힣":
        return (ord(last) - ord("가")) % 28 != 0

    return False


def topic_particle(word):
    """
    은/는 붙이기
    """
    return word + ("은" if has_batchim(word) else "는")


def object_particle(word):
    """
    을/를 붙이기
    """
    return word + ("을" if has_batchim(word) else "를")


def build_sentence(words):
    """
    수어 단어 리스트를 간단한 자연어 문장으로 변환

    예)
    ["나", "저녁", "먹다"]
    -> "나는 저녁을 먹는다."
    """

    if not words:
        return

    # 중복 제거
    cleaned = []

    for word in words:
        if not cleaned or cleaned[-1] != word:
            cleaned.append(word)

    words = cleaned

    # --------------------------------------------------------
    # 1. 단어가 하나뿐인 경우
    # --------------------------------------------------------

    if len(words) == 1:

        word = words[0]

        if word == "안녕하세요":
            return "안녕하세요."

        if word == "감사합니다":
            return "감사합니다."

        if word == "미안합니다":
            return "미안합니다."

        if word == "반갑다":
            return "반갑습니다."

        if word == "괜찮다":
            return "괜찮습니다."

        return word + "."

    # --------------------------------------------------------
    # 2. 의문문 처리
    # --------------------------------------------------------

    if "누구" in words:

        if "당신" in words:
            return "당신은 누구입니까?"

        return "누구입니까?"

    if "무엇" in words:

        if "원하다" in words:

            if "당신" in words:
                return "당신은 무엇을 원합니까?"

            return "무엇을 원합니까?"

        return "무엇입니까?"

    if "어디" in words:

        if "당신" in words:
            return "당신은 어디에 있습니까?"

        return "어디입니까?"

    if "언제" in words:
        return "언제입니까?"

    # --------------------------------------------------------
    # 3. 주어 찾기
    # --------------------------------------------------------

    subject = None

    if "나" in words:
        subject = "나"

    elif "우리" in words:
        subject = "우리"

    elif "당신" in words:
        subject = "당신"

    # --------------------------------------------------------
    # 4. 동사 찾기
    # --------------------------------------------------------

    verb = None

    for word in reversed(words):
        if word in VERB_ENDINGS:
            verb = word
            break

    # --------------------------------------------------------
    # 5. 목적어 찾기
    # --------------------------------------------------------

    obj = None

    for word in words:

        if word in OBJECT_WORDS:
            obj = word
            break

    # --------------------------------------------------------
    # 6. 문장 생성
    # --------------------------------------------------------

    sentence_parts = []

    if subject:
        sentence_parts.append(topic_particle(subject))

    # 시간 표현
    if "어제" in words:
        sentence_parts.append("어제")

    if "지금" in words:
        sentence_parts.append("지금")

    # 저녁 + 먹다는 특별히 목적어로 처리
    if "저녁" in words and verb == "먹다":
        sentence_parts.append("저녁을")

    elif obj:
        sentence_parts.append(object_particle(obj))

    # 동사
    if verb:
        sentence_parts.append(VERB_ENDINGS[verb])

    # 동사를 못 찾은 경우
    if not verb:

        remaining = [
            word for word in words
            if word not in {subject, "어제", "지금"}
        ]

        sentence_parts.extend(remaining)

    sentence = " ".join(sentence_parts)

    if sentence:
        sentence += "."

    return sentence