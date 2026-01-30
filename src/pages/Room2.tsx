import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { MdCall, MdCallEnd } from 'react-icons/md';
import { BsSend } from "react-icons/bs";
import { FaVideo, FaVideoSlash } from 'react-icons/fa';
import { HiMiniSpeakerWave, HiMiniSpeakerXMark } from 'react-icons/hi2';

const socket = io('https://webrtc-backend-qckx.onrender.com', {
  transports: ["polling", "websocket"],
  secure: true,
});

const Room2: React.FC = () => {
  const { roomId, name } = useParams<{ roomId: string; name: string }>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [showRemoteStream, setShowRemoteStream] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState('');
  const [remoteUserName, setRemoteUserName] = useState('');
  const [remoteOffer, setRemoteOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [fromOffer, setFromOffer] = useState('');
  const [isInitiator, setIsInitiator] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ from: string; message: string }[]>([]);
//   const [isRemoteVideoEnlarged, setIsRemoteVideoEnlarged] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // ✅ Create peer connection
  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        socket.emit('ice-candidate', { candidate: event.candidate, to: remoteUserId });
      }
    };

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setShowRemoteStream(true);
      }
    };

    peerConnectionRef.current = peer;
    return peer;
  };

  // ✅ Get local media stream and attach to local video
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection immediately
      const pc = peerConnectionRef.current || createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (err) {
      console.error("Error accessing local media devices:", err);
      toast.error("Cannot access camera/mic. Make sure you allowed permissions.");
    }
  };

  // ✅ Join room
  const joinRoom = () => {
    socket.emit('join-room', { roomId, name });
  };

  const handleUserJoined = ({ name, userId }: { name: string; userId: string }) => {
    toast.success(`${name} is online`);
    setRemoteUserId(userId);
    setRemoteUserName(name);
  };

  // ✅ Handle offer received
  const handleOfferReceived = async ({ offer, from, name }: any) => {
    toast.success(`${name} is calling!`);
    setRemoteOffer(offer);
    setFromOffer(from);
    setRemoteUserName(name);
    setIsInitiator(false);
  };

  const answerCall = async () => {
    if (!peerConnectionRef.current || !remoteOffer) return;

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socket.emit('send-answer', { answer: peerConnectionRef.current.localDescription, to: fromOffer });
    setShowRemoteStream(true);
  };

  const handleAnswerReceived = async ({ answer }: any) => {
    if (!peerConnectionRef.current) return;
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    setShowRemoteStream(true);
  };

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setShowRemoteStream(false);
    socket.emit('end-call', { name, remoteUserId, isStreamExist: localStream ? true : false });
  };

  const handleEndCallReceiver = (name: string) => {
    toast.error(`${name} ended the call`);
    endCall();
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  // ✅ Messages
  const handleMessageReceived = ({ message, from }: any) => {
    setMessages(prev => [...prev, { from, message }]);
  };

  useEffect(() => {
    peerConnectionRef.current = createPeerConnection();
    initLocalStream();
    joinRoom();

    socket.on('user-joined', handleUserJoined);
    socket.on('offer-received', handleOfferReceived);
    socket.on('answer-received', handleAnswerReceived);
    socket.on('end-call-reciever', handleEndCallReceiver);
    socket.on('message-received', handleMessageReceived);
    socket.on('ice-candidate', async ({ candidate }: any) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('show-call-button', () => setIsInitiator(true));
    socket.on('show-answer-button', () => setIsInitiator(false));

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('offer-received', handleOfferReceived);
      socket.off('answer-received', handleAnswerReceived);
      socket.off('end-call-reciever', handleEndCallReceiver);
      socket.off('message-received', handleMessageReceived);
      socket.off('ice-candidate');
      socket.off('show-call-button');
      socket.off('show-answer-button');
      peerConnectionRef.current?.close();
    };
  }, []);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="flex flex-col w-full lg:flex-row lg:w-[83vw] h-auto">
        <div className="w-full lg:w-full flex flex-col p-5 justify-center items-center h-full gap-3">
          <div className="w-full relative rounded-xl overflow-hidden bg-zinc-700">
            {/* Local Video */}
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-xl" />

            {/* Remote Video */}
            {showRemoteStream && (
              <div className="absolute bottom-3 right-3 w-[220px] h-[150px] rounded-lg overflow-hidden shadow-lg cursor-pointer">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute px-2 py-1 bg-zinc-800 bottom-1 left-1 rounded-md text-xs">
                  <h2 className="font-semibold text-center">{remoteUserName}</h2>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center bg-zinc-800 px-3 py-2 rounded-full h-auto gap-3 flex-wrap">
            {!showRemoteStream ? (
              <>
                {isInitiator && <MdCall size={25} onClick={() => peerConnectionRef.current?.createOffer()} />}
                {!isInitiator && remoteOffer && <MdCallEnd size={25} onClick={answerCall} />}
              </>
            ) : (
              <>
                <MdCallEnd size={25} onClick={endCall} />
              </>
            )}
            <span onClick={toggleVideo}>{isVideoOn ? <FaVideoSlash size={25} /> : <FaVideo size={25} />}</span>
            <span onClick={toggleAudio}>{isAudioOn ? <HiMiniSpeakerXMark size={25} /> : <HiMiniSpeakerWave size={25} />}</span>
          </div>
        </div>

        {/* Chat */}
        <div className="lg:w-full w-full p-5 space-y-2">
          <div className="bg-zinc-800 rounded-xl h-[79vh] overflow-auto">
            <div className="p-4">
              {messages.length === 0 ? (
                <div className="text-center w-full flex items-center justify-center h-[70vh]">
                  Chatting is not started yet
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`chat ${msg.from === name ? 'chat-end' : 'chat-start'}`}>
                    <div className="chat-header">{msg.from}</div>
                    <div className="chat-bubble">{msg.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="bg-zinc-800 h-auto w-full space-x-2 rounded-xl p-3 flex items-center justify-center">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="input input-sm w-full outline-none focus-none"
            />
            <span
              onClick={() => {
                if (message.trim() !== '') {
                  socket.emit('send-message', { message, room: roomId, from: name });
                  setMessage('');
                }
              }}
              className="bg-zinc-700 p-2.5 rounded-full flex items-center justify-center"
            >
              <BsSend />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room2;
