import express from 'express';
import multer from 'multer';
import colors from 'colors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { s3DeleteV3, s3GetUrlV3, s3UploadV3 } from './s3Service.js';
import DBConfig from './DBConfig.js';
import ImagePost from './model/postModel.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 5000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()})}`;

    cb(null, `${file.originalname}-${uniqueSuffix}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg'
  ) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), false);
    return;
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2500000, files: 10 },
});

app.post('/upload', upload.array('file'), async (req, res) => {
  try {
    const files = req.files;

    const result = await s3UploadV3(files);

    if (result) {
      files.map((file) => {
        fs.unlinkSync(file.path);
      });

      const images = result.imageKey.map((key) => ({
        imageKey: key,
        url: '',
      }));

      const newImageUpload = new ImagePost({ images });
      await newImageUpload.save();

      res.json({
        message: 'Successful upload',
        status: 201,
        success: true,
        result,
        newImageUpload,
      });
    } else {
      files.map((file) => {
        fs.unlinkSync(file.path);
      });
      res.json({
        message: 'Unable to upload images',
        success: false,
      });
      return;
    }
  } catch (error) {
    return res.json({
      error: error.message,
      status: 500,
      success: false,
    });
  }
});

app.get('/api/get-image/:id', async (req, res) => {
  try {
    const imageData = await ImagePost.findOne({ _id: req.params.id });

    if (!imageData) {
      return res.json({
        message: 'Image data not found',
        status: 404,
        success: false,
      });
    }

    const images = Array.isArray(imageData.images)
      ? imageData.images
      : [imageData.images];

    const allUrlsEmpty = images.every((image) => image.url === '');

    if (allUrlsEmpty) {
      const result = await s3GetUrlV3(imageData.images);

      images.forEach(async (image) => {
        const matchingResult = result.find((res) => res.key === image.imageKey);
        if (matchingResult) {
          image.url = matchingResult.url;
          const updatedImage = await ImagePost.updateOne(
            { _id: req.params.id, 'images._id': image._id },
            { $set: { 'images.$.url': matchingResult.url } },
            { new: true }
          );
        }
      });

      return res.json({
        message: 'Images fetched successfully',
        success: true,
        status: 200,
        imageData,
      });
    } else {
      return res.json({
        message: 'Images fetched successfully',
        success: true,
        status: 200,
        url: imageData,
      });
    }
  } catch (error) {
    return res.json({
      message: 'Something happened',
      success: false,
      status: 500,
      error: error.message,
    });
  }
});

app.delete('/api/delete-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const imageToDelete = await ImagePost.findOne({ _id: id });

    if (!imageToDelete) {
      return res.json({
        message: 'Image can not be found',
        status: 404,
        success: false,
      });
    }

    const response = await s3DeleteV3(imageToDelete.images, res);
    if (!response) {
      return res.json({
        message: 'Unable to delete image',
        status: 400,
        success: false,
      });
    }

    await imageToDelete.deleteOne();

    return res.json({
      message: 'Image deleted successfully',
      status: 200,
      success: true,
      imageToDelete,
    });
  } catch (error) {
    return res.json({
      message: 'Something happened',
      status: 500,
      success: false,
      error: error.message,
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File is too large',
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'File format is not supported',
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'File limit reached',
      });
    }
  }
});

app.listen(port, () => {
  console.log(`SERVER LISTENING ON PORT ${port}`.rainbow.underline);
});
