import mongoose from 'mongoose';

const DBConfig = mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log(
      `MongoDB connected successfully to ${mongoose.connection.host}`.blue.bold
    );
  })
  .catch((error) => {
    console.log('error connecting to MongoDB', error.message);
    process.exit(1);
  });

export default DBConfig;
