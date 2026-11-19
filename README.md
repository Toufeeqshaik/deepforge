# DeepForge

**AI-Powered Digital Media Forensics & Deepfake Intelligence Platform**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38b2ac.svg)

---

## Overview

DeepForge is a professional-grade, AI-powered digital media forensics platform capable of detecting face-swap deepfakes in images. Built with transparency and honesty at its core, DeepForge provides forensic-level analysis with explainable AI results.

### What It Does

- **Upload images** in JPG, JPEG, PNG, or WEBP format
- **Real-time face-swap deepfake detection** using a lightweight baseline model
- **Honest, explainable results** - never presents AI scores as absolute truth
- **Detailed forensic reports** - calibrated confidence scores, detection details, and limitations

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, PyTorch, Transformers |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| AI Model | EfficientNet-B0 (Xicor9/efficientnet-b0-ffpp-c23) |

---

## Quick Start

### Prerequisites

- Python 3.11 or 3.12
- Node.js 20+
- Git

### Installation

```bash
# Clone the repository
git clone <your-fork-url>
cd deepforge

# Set up backend
cd backend
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

# Set up frontend
cd ../frontend
npm install
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd path/to/deepforge/backend
.venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0
```

**Terminal 2 - Frontend:**
```bash
cd path/to/deepforge/frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## How It Works

### The Detection Process

1. **Upload** - Submit an image file
2. **Validation** - Backend validates file type and size
3. **Preprocessing** - Image is prepared for the AI model
4. **Analysis** - EfficientNet-B0 model analyzes the image
5. **Results** - Honest, explainable verdict with confidence scores

### What It Detects

DeepForge uses a model trained on **FaceForensics++ C23** to detect:

- ✅ **DeepFake** - Face swapping with deep learning
- ✅ **FaceSwap** - Manual or automated face replacement
- ✅ **Face2Face** - Facial reenactment
- ✅ **NeuralTextures** - Texture manipulation

### Model Details

| Property | Value |
|---|---|
| Model | Xicor9/efficientnet-b0-ffpp-c23 |
| Architecture | EfficientNet-B0 |
| Training Dataset | FaceForensics++ C23 |
| Frame-Level Accuracy | 85.2% (model author's benchmark on FF++ C23, not our own testing) |
| Inference Time | ~30ms on CPU |

---

## Important Notes

### What This Is NOT

- ❌ **Not legal evidence** - Results are forensic indicators, not courtroom proof
- ❌ **Not 100% accurate** - Expect false positives/negatives (~10-15%)
- ❌ **Trained on face-swap data only** - Designed to detect face-swap manipulations (DeepFake, FaceSwap, Face2Face, NeuralTextures) from the FaceForensics++ dataset

### Honest Limitations

From the UI, users see:

> "Face-swap deepfake detector (EfficientNet-B0, FaceForensics++ C23). Accuracy: 85.2% (frame-level) on FF++ C23 per the model author's benchmark — not verified by our own testing. Cross-dataset accuracy drops on newer manipulations or heavily compressed images. Confidence scores are calibrated indicators, not true probabilities."

### Privacy & Security

- Files are stored temporarily in `/backend/uploads/` with unique analysis IDs
- All files are deleted after analysis completes
- No data is sent to external servers
- Runs entirely on your local machine

---

## For Team Members

### Development Workflow

```bash
# Install dependencies
cd backend && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install

# Run backend
cd ../backend
.venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload

# Run frontend (in another terminal)
cd path/to/deepforge/frontend
npm run dev
```

### Testing

- Upload test images (real and deepfake) to verify detection
- Check browser console for any errors
- Verify both Simple and Advanced modes work
- Test error handling with invalid files

### File Structure

```
deepforge/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes
│   │   ├── core/         # Configuration, exceptions
│   │   ├── models/       # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── main.py       # FastAPI app
│   ├── uploads/          # Temporary file storage
│   └── requirements.txt  # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/   # Reusable React components
    │   ├── pages/        # Page components
    │   └── lib/          # Utilities and API client
    └── package.json      # Node dependencies
```

---

## Project Roadmap

- [x] Face-swap deepfake detection (v1.0)
- [ ] Video deepfake detection
- [ ] Audio deepfake detection
- [ ] Multimodal analysis (audio + video)
- [ ] Explainable AI visualizations (Grad-CAM heatmaps)
- [ ] PDF report generation

---

## Models and Licenses

| Model | Source | License | Used for |
|---|---|---|---|
| EfficientNet-B0 (ffpp-c23) | [Xicor9/efficientnet-b0-ffpp-c23](https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23) on Hugging Face | verify on the model page | Face-swap deepfake detection in images |

> **Note:** Always check the model card on Hugging Face before using this model in any commercial or research context. The FaceForensics++ training data has its own [terms of use](https://github.com/ondyari/FaceForensics).

---

## Known Limitations

- **Fully AI-generated images are not reliably detected.** The model was trained on face-swap manipulations (DeepFake, FaceSwap, Face2Face, NeuralTextures). It was not trained on diffusion-model outputs such as those from Midjourney, Stable Diffusion, or DALL-E, and may give incorrect or misleading scores on those images.
- **Compression degrades accuracy.** Heavy JPEG compression or resizing can remove the subtle artifacts the model relies on, leading to false negatives.
- **Single-image analysis only.** Video deepfake detection is not yet implemented; uploading a video frame is not a substitute for temporal analysis.
- **Accuracy figures are from the model author's benchmark**, measured on the FaceForensics++ C23 test set. Performance on other datasets or real-world images may differ significantly.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- FaceForensics++ dataset for training data
- EfficientNet-B0 model by Xicor9
- Hugging Face for model hosting

---

## Contact

For issues or questions, please open an issue on GitHub.

---

*DeepForge v1.0 - AI-Powered Digital Media Forensics*
