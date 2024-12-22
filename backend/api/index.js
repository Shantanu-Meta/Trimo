const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const os = require("os");
const streamifier = require("streamifier");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const port = 5000;

// Set up multer storage (using memoryStorage for serverless compatibility)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Set max file size (e.g., 50MB)
});
const cors = require("cors");

app.use(cors());


// POST route for cutting audio
app.post("/cut-audio", upload.single("audio"), (req, res) => {
  if (!req.file || !req.body.timelines) {
    return res.status(400).send("Audio file or timeline is missing.");
  }

  const audioBuffer = req.file.buffer;
  const timelines = JSON.parse(req.body.timelines);

  // Write the buffer to a temporary file
  const tempInputPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
  fs.writeFileSync(tempInputPath, audioBuffer);

  // Process the file with ffmpeg
  ffmpeg(tempInputPath)
    .ffprobe((err, metadata) => {
      if (err) {
        return res.status(500).send("Error getting audio metadata: " + err);
      }

      const totalDuration = metadata.format.duration;

      // Create segments to keep
      let segments = [];
      let currentTime = 0;
      for (let i = 0; i < timelines.length; i++) {
        const timeline = timelines[i];
        if (timeline.start > currentTime) {
          segments.push({ start: currentTime, end: timeline.start });
        }
        currentTime = timeline.end;
      }
      if (currentTime < totalDuration) {
        segments.push({ start: currentTime, end: totalDuration });
      }

      // Generate segment files
      const segmentPromises = segments.map((segment, index) => {
        return new Promise((resolve, reject) => {
          const segmentPath = path.join(os.tmpdir(), `segment-${index}.mp3`);
          ffmpeg(tempInputPath)
            .setStartTime(segment.start)
            .setDuration(segment.end - segment.start)
            .output(segmentPath)
            .on("end", () => resolve(segmentPath))
            .on("error", (err) => reject(err))
            .run();
        });
      });

      // Wait for all segments to be generated
      Promise.all(segmentPromises)
        .then((segmentPaths) => {
          // Concatenate segments
          const concatFilePath = path.join(os.tmpdir(), "concat-list.txt");
          const concatFileContent = segmentPaths
            .map((filePath) => `file '${filePath}'`)
            .join("\n");
          fs.writeFileSync(concatFilePath, concatFileContent);

          const outputPath = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

          // Concatenate segments and create the final file
          ffmpeg()
            .input(concatFilePath)
            .inputOptions(["-f", "concat", "-safe", "0"])
            .outputOptions(["-c", "copy"])
            .output(outputPath)
            .on("end", () => {
              res.download(outputPath, "Audio.mp3", (err) => {
                if (err) {
                  res.status(500).send("Error downloading the file.");
                }

                // Clean up temporary files
                fs.unlinkSync(tempInputPath);
                segmentPaths.forEach((segmentPath) => fs.unlinkSync(segmentPath));
                fs.unlinkSync(concatFilePath);
                fs.unlinkSync(outputPath);
              });
            })
            .on("error", (err) => {
              res.status(500).send("Error merging audio: " + err.message);
            })
            .run();
        })
        .catch((err) => {
          res.status(500).send("Error processing audio segments: " + err.message);
        });
    });
});

// Start the server
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
