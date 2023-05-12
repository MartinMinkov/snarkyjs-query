import { PineconeClient } from "@pinecone-database/pinecone";

async function buildPineconeClient() {
  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY as string,
    environment: process.env.PINECONE_ENVIRONMENT as string,
  });
  return client;
}

const pinecone = buildPineconeClient();

export { pinecone };
