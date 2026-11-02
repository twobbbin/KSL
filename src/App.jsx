import { Routes, Route } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Realtime from './pages/Realtime.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/realtime" element={<Realtime />} />
    </Routes>
  );
}

export default App;