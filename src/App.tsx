
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room2 from "./pages/Room2";
import LandingPage from "./pages/LandingPage";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room" element={<Home />} />
        <Route path="/room/:roomId/:name" element={<Room2 />} />
      </Routes>
    </BrowserRouter>
  );
}