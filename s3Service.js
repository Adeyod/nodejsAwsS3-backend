import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import ImagePost from './model/postModel.js';
dotenv.config();

const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_REGION;

const s3client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});

const s3UploadV3 = async (files) => {
  const results = [];
  const imageKey = [];
  const urls = [];

  async function getFileBuffer(path) {
    try {
      const data = await fs.promises.readFile(path);
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  for (const file of files) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const path = file.path;
    const fileBuffer = await getFileBuffer(path);

    const param = {
      Bucket: bucketName,
      Key: `uploads/${uniqueSuffix}-${file.originalname}`,
      Body: fileBuffer,
      ContentType: file.mimetype,
    };

    try {
      const command = new PutObjectCommand(param);

      const result = await s3client.send(command);

      results.push(result);
      imageKey.push(param.Key);
    } catch (error) {
      console.error(error.message);
      return;
    }
  }

  return { results, imageKey };
};

const s3GetUrlV3 = async (images) => {
  try {
    const results = await Promise.all(
      images.map(async (image) => {
        const key = image.imageKey;
        const input = {
          Bucket: bucketName,
          Key: key,
        };
        const command = new GetObjectCommand(input);
        const webSite = await getSignedUrl(s3client, command);

        const site = webSite.split('?');

        return { url: site[0], key };
      })
    );

    return results;
  } catch (error) {
    console.log('Error fetching images', error.message);
    // throw error.message;
  }
};

const s3DeleteV3 = async (images, res) => {
  try {
    const results = await Promise.all(
      images.map(async (image) => {
        const input = {
          Bucket: bucketName,
          Key: image.imageKey,
        };

        const command = new DeleteObjectCommand(input);
        const response = await s3client.send(command);
      })
    );
    return results;
  } catch (error) {
    console.log(error.message);
    // return res.json({
    //   error: error.message,
    //   status: 500,
    // });
  }
};

export { s3UploadV3, s3GetUrlV3, s3DeleteV3 };
