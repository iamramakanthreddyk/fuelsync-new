
const { BlobServiceClient } = require('@azure/storage-blob');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');

// Azure Blob Storage Client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

// Azure Computer Vision Client
const cognitiveServiceCredentials = new CognitiveServicesCredentials(
  process.env.AZURE_VISION_KEY
);

const computerVisionClient = new ComputerVisionClient(
  cognitiveServiceCredentials,
  process.env.AZURE_VISION_ENDPOINT
);

// Container names
const CONTAINERS = {
  RECEIPTS: 'receipts',
  REPORTS: 'reports'
};

// Initialize containers
const initializeContainers = async () => {
  try {
    for (const containerName of Object.values(CONTAINERS)) {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists({
        access: 'private'
      });
    }
    console.log('✅ Azure containers initialized');
  } catch (error) {
    console.error('❌ Error initializing Azure containers:', error);
  }
};

module.exports = {
  blobServiceClient,
  computerVisionClient,
  CONTAINERS,
  initializeContainers
};
