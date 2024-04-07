import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  imageKey: { type: String },
  url: { type: String },
});

const imagePostSchema = new mongoose.Schema(
  {
    images: [imageSchema],
  },
  { timestamps: true }
);

const ImagePost = mongoose.model('ImagePost', imagePostSchema);
export default ImagePost;
