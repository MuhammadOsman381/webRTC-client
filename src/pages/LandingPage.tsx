// LandingPage.tsx
import { useNavigate } from "react-router-dom";
import img from "../assets/chat-hero.jpg";
import GridBackground from "../components/GridBackground";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-transparent to-orange-500 flex items-center justify-center px-4">
      {/* Hero Section */}
      <GridBackground/>
      <div className="hero w-full max-w-5xl  rounded-3xl  p-8 lg:p-16 flex flex-col lg:flex-row items-center gap-12">
        
        {/* Image / Illustration */}
        <div className="flex-1 relative">
          <img
            src={img}
            alt="Chat illustration"
            className="rounded-2xl shadow-2xl w-full object-cover"
          />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
        </div>

        {/* Text Content */}
        <div className="flex-1 text-center lg:text-left space-y-6">
          <h1 className="text-5xl font-extrabold text-gray-100">
            Connectly
          </h1>
          <p className="text-lg text-gray-400">
            Create your own chat room in seconds and start conversations with friends or colleagues. Fast, simple, and secure.
          </p>
          <button
            className="btn bg-orange-600 btn-md transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
            onClick={() => navigate("/room")}
          >
            Get Started
          </button>
        </div>
      </div>

      {/* Floating Decorative Circles */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-orange-300 rounded-full opacity-40 animate-pulse"></div>
      <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-orange-200 rounded-full opacity-30 animate-pulse"></div>
    </div>
  );
}
