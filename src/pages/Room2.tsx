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
    const [isRemoteVideoEnlarged, setIsRemoteVideoEnlarged] = useState(false);
    const [showMobileChat, setShowMobileChat] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteScreenShareRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const createPeerConnection = () => {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: [
                        'stun:stun.l.google.com:19302',
                        'stun:global.stun.twilio.com:3478',
                    ],
                },
            ],
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { candidate: event.candidate, to: remoteUserId });
            }
        };

        peer.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        let isNegotiating = false;
        peer.onnegotiationneeded = async () => {
            if (isNegotiating) return;
            isNegotiating = true;
            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socket.emit('send-offer', {
                    offer: peer.localDescription,
                    to: remoteUserId,
                    name: name,
                });
            } catch (err) {
                console.error('Negotiation error:', err);
            } finally {
                isNegotiating = false;
            }
        };

        peerConnectionRef.current = peer;
        return peer;
    };

    const handleLocalUserStreamAndCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            if (!stream) {
                console.log(stream)
                console.error('Stream is null');
                return;
            }
            console.log(stream)
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // const pc = peerConnectionRef.current || createPeerConnection();
            // stream.getTracks().forEach(track => pc.addTrack(track, stream));

        } catch (error) {
            console.error('Error accessing media devices.', error);
        }
    };

    const handleJoinRoom = ({ name, userId }: { name: string; userId: string }) => {
        toast.success(`${name} is online`);
        setRemoteUserId(userId);
        setRemoteUserName(name);
    };

    const sendOffer = async () => {
        const offer = await peerConnectionRef.current?.createOffer();
        await peerConnectionRef.current?.setLocalDescription(offer);
        socket.emit('send-offer', {
            offer: peerConnectionRef.current?.localDescription,
            to: remoteUserId,
            name: name,
        });
    };

    const handleOfferReceived = async ({
        offer,
        from,
        name,
    }: {
        offer: RTCSessionDescriptionInit;
        from: string;
        name: string;
    }) => {
        toast.success(`${name} is calling!`);
        setRemoteOffer(offer);
        setFromOffer(from);
        setIsInitiator(false);
        setRemoteUserName(name);
    };

    const answerCaller = async () => {
        setShowRemoteStream(true);
        if (peerConnectionRef.current && remoteOffer !== null) {
            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(remoteOffer)
            );
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            socket.emit('send-answer', {
                answer: peerConnectionRef.current.localDescription,
                to: fromOffer,
            });
        }
    };

    const handleReceivedAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        setShowRemoteStream(true);
        const peer = peerConnectionRef.current;
        await peer?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const endCall = () => {
        setShowRemoteStream(false);
        if (localVideoRef.current?.srcObject) {
            const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach((track) => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        socket.emit('end-call', {
            name,
            remoteUserId,
            isStreamExist: localStream ? true : false,
        });
    };

    const handleEndCallReciever = (name: string) => {
        toast.error(`${name} ended the call`);
        if (localVideoRef.current?.srcObject) {
            const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach((track) => track.stop());
            localVideoRef.current.srcObject = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        setShowRemoteStream(false);
    };

    const turnOnAndOffVideo = () => {
        if (localVideoRef.current) {
            const videoRef = localVideoRef.current.srcObject as MediaStream;
            const videoTrack = videoRef.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOn(videoTrack.enabled);
            }
        }
    };

    const turnOnAndOffAudio = () => {
        if (localVideoRef.current) {
            const videoRef = localVideoRef.current.srcObject as MediaStream;
            const audioTrack = videoRef.getAudioTracks()[0];
            console.log(audioTrack)
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioOn(audioTrack.enabled);
            }
        }
    };

    const handleScreenShareStartedRemote = ({ name }: { name: string }) => {
        const peer = peerConnectionRef.current;
        if (!peer) return;
        toast.success(`${name} started screen sharing`);
        peer.ontrack = (event) => {
            if (remoteScreenShareRef.current) {
                remoteScreenShareRef.current.srcObject = event.streams[1];
            }
        };
    };


    const handleMessageReceived = ({ message, from }: { message: string; from: string }) => {
        setMessages((prevMessages) => [...prevMessages, { from, message }]);
    };

    useEffect(() => {
        socket.emit('join-room', { roomId, name });
        socket.on('user-joined', handleJoinRoom);
        socket.on('offer-received', handleOfferReceived);
        socket.on('answer-received', handleReceivedAnswer);
        socket.on('end-call-reciever', handleEndCallReciever);
        socket.on('screen-share-started-remote', handleScreenShareStartedRemote);
        socket.on('message-received', handleMessageReceived)
        socket.on('show-call-button', () => {
            setIsInitiator(true);
        });
        socket.on('show-answer-button', () => {
            setIsInitiator(false);
        });
        socket.on('ice-candidate', async ({ candidate }: any) => {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });
        return () => {
            socket.off('user-joined', handleJoinRoom);
            socket.off('offer-received', handleOfferReceived);
            socket.off('answer-received', handleReceivedAnswer);
            socket.off('show-call-button');
            socket.off('show-answer-button');
            socket.off('end-call-reciever', handleEndCallReciever);
            socket.off('ice-candidate');
            socket.off('screen-share-started-remote', handleScreenShareStartedRemote);
            socket.off('message-received', handleMessageReceived)
            if (localStream) {
                localStream.getTracks().forEach((track) => track.stop());
            }
            peerConnectionRef.current?.close();
        };
    }, [roomId, name]);


    useEffect(() => {
        const pc = createPeerConnection(); // create once

        const startStream = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            // ✅ Add tracks only once
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        };

        startStream();
    }, []);


    useEffect(() => {
        localStream?.getTracks().forEach((track) => {
            peerConnectionRef.current?.addTrack(track, localStream);
        });
    }, [localStream]);

    useEffect(() => {
        handleLocalUserStreamAndCall();
        createPeerConnection();
    }, []);


    return (
        <div className="flex h-screen bg-background text-foreground relative">
            {/* ================= SHOW CHAT BUTTON ON MOBILE ================= */}
            <button
                className="absolute top-2 right-4 z-50 md:hidden bg-orange-500 text-primary-foreground px-4 py-2 rounded-full shadow-lg"
                onClick={() => setShowMobileChat(!showMobileChat)}
            >
                {showMobileChat ? "Hide Chat" : "Show Chat"}
            </button>

            {/* ================= VIDEO SECTION ================= */}
            <div
                className={`flex-1 flex flex-col bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] relative p-4 transition-all duration-300
      ${showMobileChat ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
    `}
            >
                {/* Main Video */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-xl shadow-xl w-full">
                    {localStream && (
                        <>
                            {isRemoteVideoEnlarged ? (
                                <>
                                    <video
                                        ref={remoteVideoRef}
                                        autoPlay
                                        playsInline
                                        onClick={() => setIsRemoteVideoEnlarged(!isRemoteVideoEnlarged)}
                                        className="w-full h-full object-cover cursor-pointer rounded-xl"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

                                    <div className="absolute bottom-6 right-6 w-32 h-24 md:w-40 md:h-32 rounded-xl overflow-hidden shadow-2xl  bg-black">
                                        <video
                                            ref={localVideoRef}
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-start justify-start p-2 text-xs">
                                            {name}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        
                                        className="w-full h-full object-cover rounded-xl"
                                    />
                                    <div className="absolute px-3 py-1 bg-zinc-800 bottom-2 left-2 rounded-md text-sm font-bold">
                                        {name}
                                    </div>

                                    {showRemoteStream && (
                                        <div
                                            className="absolute bottom-6 right-6 w-32 h-24 md:w-40 md:h-32 rounded-xl overflow-hidden shadow-2xl  bg-black cursor-pointer"
                                            onClick={() => setIsRemoteVideoEnlarged(true)}
                                        >
                                            <video
                                                ref={remoteVideoRef}
                                                autoPlay
                                                playsInline
                                                
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-start justify-start p-2 text-xs">
                                                {remoteUserName}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* Video Controls Overlay */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4  backdrop-blur-lg px-6 py-3 rounded-full z-50">
                        {!showRemoteStream ? (
                            <>
                                {isInitiator && !remoteOffer && (
                                    <button
                                        onClick={sendOffer}
                                        className="p-3 rounded-full bg-orange-500 hover:bg-orange-600"
                                    >
                                        <MdCall size={20} />
                                    </button>
                                )}
                                {!isInitiator && remoteOffer && (
                                    <button
                                        onClick={answerCaller}
                                        className="p-3 rounded-full bg-orange-500 hover:bg-orange-600"
                                    >
                                        <MdCallEnd size={20} />
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={endCall}
                                className="p-3 rounded-full bg-orange-500 hover:bg-orange-600"
                            >
                                <MdCallEnd size={20} />
                            </button>
                        )}

                        <button
                            onClick={turnOnAndOffVideo}
                            className={`p-3 rounded-full ${isVideoOn ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                        >
                            {isVideoOn ? <FaVideoSlash size={20} /> : <FaVideo size={20} />}
                        </button>

                        <button
                            onClick={turnOnAndOffAudio}
                            className={`p-3 rounded-full ${isAudioOn ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                        >
                            {isAudioOn ? <HiMiniSpeakerXMark size={20} /> : <HiMiniSpeakerWave size={20} />}
                        </button>
                    </div>
                </div>

                {/* Caller Info */}
                <div className="absolute top-6 left-6 flex items-center gap-3 bg-orange-400/80 backdrop-blur-xl px-4 py-2 rounded-full">
                    <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{remoteUserName}</span>
                    <span className="text-xs text-muted-foreground">12:34</span>
                </div>
            </div>

            {/* ================= CHAT SECTION ================= */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-md  md:relative md:w-96 bg-card border-l border-zinc-700 transition-transform duration-300 z-40
      ${showMobileChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
    `}
            >
                {/* Chat Header */}
                <div className="px-6 py-4 border-zinc-700 border-b  flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Chat</h2>
                    <button
                        className="md:hidden text-sm font-medium text-primary"
                        onClick={() => setShowMobileChat(false)}
                    >
                        Close
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 h-[84vh] overflow-y-auto px-4 py-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center w-full flex items-center justify-center h-[80vh]  text-muted-foreground">
                            Chatting is not started yet
                        </div>
                    )}

                    {messages.map((msg, index) =>
                        msg.from === name ? (
                            <div key={index} className="flex justify-end">
                                <div className="max-w-xs px-4 py-2 rounded-2xl shadow-sm bg-orange-500 text-primary-foreground rounded-br-none">
                                    {msg.message}
                                </div>
                            </div>
                        ) : (
                            <div key={index} className="flex justify-start">
                                <div className="max-w-xs px-4 py-2 rounded-2xl shadow-sm bg-zinc-700 text-foreground rounded-bl-none">
                                    {msg.message}
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Input Area */}
                <form
                    onSubmit={
                        (e) => {

                            e.preventDefault();
                            if (message.trim() !== '') {
                                socket.emit('send-message', { message, room: roomId, from: name })
                                setMessage('')
                            }
                        }
                    }
                    className="px-4 py-4 border-t border-zinc-700 flex gap-2">
                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 px-4 py-2 bg-input border border-zinc-700 rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                    <button
                        onClick={() => {
                            if (message.trim() !== '') {
                                socket.emit('send-message', { message, room: roomId, from: name })
                                setMessage('')
                            }
                        }}
                        className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 text-primary-foreground flex items-center justify-center"
                    >
                        <BsSend />
                    </button>
                </form>
            </div>
        </div>


    );
};

export default Room2;