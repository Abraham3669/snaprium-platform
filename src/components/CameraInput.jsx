import { processImage } from '../utils/apiClient';

// inside your function/component:
const handleUpload = async () => {
  try {
    const result = await processImage({ image: base64Image, someParam: value });
    console.log('Server result:', result);
    // update state, show in ResultPanel, etc.
  } catch (err) {
    // show error
  }
};