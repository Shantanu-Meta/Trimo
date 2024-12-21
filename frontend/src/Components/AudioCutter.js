import React, { useState, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { useDropzone } from "react-dropzone";

// Helper function to format seconds into MM:SS:MS
const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${min}:${sec.toString().padStart(2, "0")}:${ms.toString().padStart(2, "0")}`;
};

const AudioCutter = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [waveform, setWaveform] = useState(null);
  const [timeLines, setTimeLines] = useState([{ start: 0, end: 0 }]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0); // Audio duration
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  // Setup file upload using react-dropzone
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    setAudioFile(file);

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#4e91ff",
      progressColor: "#003366",
      cursorColor: "#ff0000",
      barWidth: 2,
      responsive: true,
      height: 150,
    });

    ws.load(URL.createObjectURL(file));
    ws.on("audioprocess", () => {
      setProgress((ws.getCurrentTime() / ws.getDuration()) * 100);
    });

    // Get the audio duration
    ws.on("ready", () => {
      setAudioDuration(ws.getDuration());
    });

    setWaveform(ws);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ".mp3,.wav",
  });

  // Handle Play/Pause functionality
  const togglePlayPause = () => {
    if (waveform) {
      if (waveform.isPlaying()) {
        waveform.pause();
        setIsPlaying(false);
      } else {
        waveform.play();
        setIsPlaying(true);
      }
    }
  };

  // Add timeline field
  const addTimeLine = () => {
    setTimeLines([...timeLines, { start: 0, end: 0 }]);
  };

  // Remove timeline field
  const removeTimeLine = (index) => {
    const newTimeLines = timeLines.filter((_, idx) => idx !== index);
    setTimeLines(newTimeLines);
  };

  // Update timeline values (convert input from MM:SS:MS into seconds)
  const updateTimeLine = (index, type, value, part) => {
    const newTimeLines = [...timeLines];
    const currentTime = newTimeLines[index][type];
    let newTimeValue = currentTime;
  
    if (part === "min") {
      newTimeValue = parseFloat(value) * 60 + newTimeValue % 60; // Convert minutes to seconds
    } else if (part === "sec") {
      newTimeValue = newTimeValue - (newTimeValue % 60) + parseFloat(value); // Update seconds part
    } else if (part === "ms") {
      newTimeValue = Math.floor(newTimeValue); // Remove minutes and seconds
      newTimeValue += parseFloat(value) / 100; // Update milliseconds part
    }
  
    newTimeLines[index][type] = newTimeValue;
    setTimeLines(newTimeLines);
  };

  // Method to cut audio by sending file and timelines to backend
  const cutAudio = async () => {
    if (!audioFile || timeLines.length === 0) {
      alert("Please upload an audio file and define timelines.");
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioFile); // Send the audio file itself
    formData.append("timelines", JSON.stringify(timeLines)); // Send the timeline data

    const response = await fetch("http://localhost:5000/cut-audio", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "processed_audio.mp3";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("Audio processed successfully!");
    } else {
      alert("Failed to process audio.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div
        {...getRootProps()}
        style={{ border: "2px dashed #000", padding: "10px", cursor: "pointer" }}
      >
        <input {...getInputProps()} />
        <p>Drag & drop an audio file here, or click to select one</p>
      </div>

      {/* Display start and end time of the audio */}
      {audioFile && (
        <div style={{ marginTop: "20px" }}>
          <p>Audio Duration: {formatTime(audioDuration)}</p>
        </div>
      )}

      {/* Waveform */}
      <div
        id="waveform"
        style={{
          width: "100%",
          height: "150px",
          marginTop: "20px",
          backgroundColor: "#f0f0f0",
          borderRadius: "8px",
        }}
      ></div>

      {/* Audio Controls */}
      <div style={{ marginTop: "20px" }}>
        <button onClick={togglePlayPause}>
          {isPlaying ? "Pause" : "Play"}
        </button>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "5px",
            backgroundColor: "#ddd",
            marginTop: "10px",
            borderRadius: "5px",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#003366",
              borderRadius: "5px",
            }}
          ></div>
        </div>
      </div>

      {/* Timeline Fields */}
      <div style={{ marginTop: "20px" }}>
        {timeLines.map((timeLine, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* Start Time Inputs */}
              <input
                type="text"
                value={Math.floor(timeLine.start / 60).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "start", e.target.value, "min")}
                placeholder="Min"
                style={{ marginRight: "5px", width: "60px" }}
              />
              <input
                type="text"
                value={Math.floor(timeLine.start % 60).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "start", e.target.value, "sec")}
                placeholder="Sec"
                style={{ marginRight: "5px", width: "60px" }}
              />
              <input
                type="text"
                value={Math.floor((timeLine.start % 1) * 100).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "start", e.target.value, "ms")}
                placeholder="MS"
                style={{ marginRight: "10px", width: "60px" }}
              />
              <span>to</span>
              {/* End Time Inputs */}
              <input
                type="text"
                value={Math.floor(timeLine.end / 60).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "end", e.target.value, "min")}
                placeholder="Min"
                style={{ marginRight: "5px", width: "60px" }}
              />
              <input
                type="text"
                value={Math.floor(timeLine.end % 60).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "end", e.target.value, "sec")}
                placeholder="Sec"
                style={{ marginRight: "5px", width: "60px" }}
              />
              <input
                type="text"
                value={Math.floor((timeLine.end % 1) * 100).toString().padStart(2, "0")}
                onChange={(e) => updateTimeLine(index, "end", e.target.value, "ms")}
                placeholder="MS"
                style={{ marginRight: "10px", width: "60px" }}
              />
              {index === timeLines.length - 1 && (
                <button onClick={addTimeLine}>+</button>
              )}
              {timeLines.length > 1 && (
                <button
                  onClick={() => removeTimeLine(index)}
                  style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cut Audio Button */}
      <button
        onClick={cutAudio}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#4e91ff",
          color: "white",
          borderRadius: "5px",
        }}
      >
        Cut Audio
      </button>
    </div>
  );
};

export default AudioCutter;
