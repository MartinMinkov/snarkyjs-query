import { PineconeClient } from "@pinecone-database/pinecone";

async function buildPineconeClient() {
  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY as string,
    environment: process.env.PINECONE_ENVIRONMENT as string,
  });
  return client;
}

async function buildPineconeIndex() {
  const client = await buildPineconeClient();
  const index = client.Index(process.env.PINECONE_INDEX as string);
  return index;
}

const pinecone = buildPineconeIndex();

export { pinecone };
