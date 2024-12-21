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
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    setAudioFile(file);

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

    ws.on("ready", () => {
      setAudioDuration(ws.getDuration());
    });

    ws.on("audioprocess", () => {
      setCurrentTime(ws.getCurrentTime());
      setProgress((ws.getCurrentTime() / ws.getDuration()) * 100);
    });

    setWaveform(ws);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: ".mp3,.wav",
  });

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

  const addTimeLine = () => {
    setTimeLines([...timeLines, { start: 0, end: 0 }]);
  };

  const removeTimeLine = (index) => {
    const newTimeLines = timeLines.filter((_, idx) => idx !== index);
    setTimeLines(newTimeLines);
  };

  const updateTimeLine = (index, type, value, part) => {
    const newTimeLines = [...timeLines];
    const currentTime = newTimeLines[index][type];
    let newTimeValue = currentTime;

    if (part === "min") {
      newTimeValue = parseFloat(value) * 60 + newTimeValue % 60;
    } else if (part === "sec") {
      newTimeValue = newTimeValue - (newTimeValue % 60) + parseFloat(value);
    } else if (part === "ms") {
      newTimeValue = Math.floor(newTimeValue);
      newTimeValue += parseFloat(value) / 100;
    }

    newTimeLines[index][type] = newTimeValue;
    setTimeLines(newTimeLines);
  };

  const cutAudio = async () => {
    if (!audioFile || timeLines.length === 0) {
      alert("Please upload an audio file and define timelines.");
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("timelines", JSON.stringify(timeLines));

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
    <div className="p-6 bg-gray-100 min-h-screen">
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-400 p-6 text-center cursor-pointer hover:border-blue-400 transition-all rounded-lg"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">Drag & drop an audio file here, or click to select one</p>
      </div>

      {audioFile && (
        <div className="mt-6 text-gray-700">
          <p>Audio Duration: {formatTime(audioDuration)}</p>
          <p>
            Current Time: <span className="font-bold">{formatTime(currentTime)}</span> /{" "}
            {formatTime(audioDuration)}
          </p>
        </div>
      )}

      <div id="waveform" className="w-full h-[10rem] bg-gray-200 rounded-lg mt-4">
        Put any song to see waveform
      </div>

      {/* Controls Below the Waveform */}
      <div className="mt-6 flex flex-col items-center">
        <button
          onClick={togglePlayPause}
          className="bg-blue-500 text-white py-2 px-4 rounded-lg shadow hover:bg-blue-600 transition-all"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div className="w-full bg-gray-300 h-2 rounded-lg mt-4 relative">
          <div
            style={{ width: `${progress}%` }}
            className="bg-blue-500 h-full rounded-lg"
          ></div>
        </div>
      </div>

      <div className="mt-6">
        {timeLines.map((timeLine, index) => (
          <div key={index} className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={Math.floor(timeLine.start / 60).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "start", e.target.value, "min")}
              placeholder="Min"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <input
              type="text"
              value={Math.floor(timeLine.start % 60).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "start", e.target.value, "sec")}
              placeholder="Sec"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <input
              type="text"
              value={Math.floor((timeLine.start % 1) * 100).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "start", e.target.value, "ms")}
              placeholder="MS"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <span>to</span>
            <input
              type="text"
              value={Math.floor(timeLine.end / 60).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "end", e.target.value, "min")}
              placeholder="Min"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <input
              type="text"
              value={Math.floor(timeLine.end % 60).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "end", e.target.value, "sec")}
              placeholder="Sec"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <input
              type="text"
              value={Math.floor((timeLine.end % 1) * 100).toString().padStart(2, "0")}
              onChange={(e) => updateTimeLine(index, "end", e.target.value, "ms")}
              placeholder="MS"
              className="border border-gray-300 rounded p-1 w-16"
            />
            <button
              onClick={addTimeLine}
              className="bg-green-500 text-white px-2 rounded"
            >
              +
            </button>
            {timeLines.length > 1 && (
              <button
                onClick={() => removeTimeLine(index)}
                className="bg-red-500 text-white px-2 rounded"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={cutAudio}
        className="bg-blue-500 text-white py-2 px-6 rounded-lg mt-6 hover:bg-blue-600 transition-all"
      >
        Cut Audio
      </button>
    </div>
  );
};

export default AudioCutter;
