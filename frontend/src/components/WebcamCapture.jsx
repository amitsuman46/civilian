import { useRef, useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';

export default function WebcamCapture({ onCapture, houseNo = '', wide = false }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const [live, setLive]         = useState(false);
  const [captured, setCaptured] = useState(null);
  const showToast               = useToast();

  useEffect(() => () => stopStream(), []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    try {
      const constraints = wide
        ? { video: { width: 1280, height: 720 }, audio: false }
        : { video: { width: 640, height: 480 }, audio: false };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; }
      setLive(true);
    } catch {
      showToast('Camera access denied or unavailable.', 'error');
    }
  };

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.88);
    setCaptured(data);
    onCapture(data);
    stopStream();
    setLive(false);
    showToast('Photo captured!', 'success');
  };

  const stop = () => {
    stopStream();
    setLive(false);
  };

  const retake = () => {
    setCaptured(null);
    onCapture(null);
    start();
  };

  return (
    <div className="webcam-container">
      <video
        ref={videoRef}
        className="webcam-video"
        autoPlay playsInline
        style={{ display: live ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} className="webcam-canvas" />

      {captured && (
        <div className="photo-overlay-wrap">
          <img src={captured} className="webcam-preview-img" alt="Captured" />
          {houseNo && <span className="photo-hno-badge">H/No {houseNo}</span>}
        </div>
      )}

      <div className="webcam-controls mt-1">
        {!live && !captured && (
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={start}>
            <i className="fas fa-video"></i> Start Camera
          </button>
        )}
        {live && (
          <>
            <button type="button" className="btn btn-success btn-sm" onClick={capture}>
              <i className="fas fa-camera"></i> Capture
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={stop}>
              <i className="fas fa-video-slash"></i> Stop
            </button>
          </>
        )}
        {captured && !live && (
          <button type="button" className="btn btn-warning btn-sm" onClick={retake}>
            <i className="fas fa-rotate-left"></i> Retake
          </button>
        )}
      </div>
    </div>
  );
}
