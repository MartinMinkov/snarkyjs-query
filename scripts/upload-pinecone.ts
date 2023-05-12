import * as dotenv from "dotenv";
dotenv.config();

import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";

const client = new PineconeClient();
await client.init({
  apiKey: process.env.PINECONE_API_KEY as string,
  environment: process.env.PINECONE_ENVIRONMENT as string,
});
const pineconeIndex = client.Index(process.env.PINECONE_INDEX as string);

async function loadCode() {
  const codeLoader = new DirectoryLoader("./data/code", {
    ".ts": (path) => new TextLoader(path),
    ".js": (path) => new TextLoader(path),
  });

  const codeDocs = await codeLoader.load();

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const codeOutput = await textSplitter.splitDocuments(codeDocs);
  return codeOutput;
}

async function loadMarkdown() {
  const markdownLoader = new DirectoryLoader("./data/markdown", {
    ".md": (path) => new TextLoader(path),
    ".mdx": (path) => new TextLoader(path),
  });

  const markdownDocs = await markdownLoader.load();
  const markdownSplitter = new MarkdownTextSplitter();
  const markdownOutput = await markdownSplitter.splitDocuments(markdownDocs);

  for (let i = 0; i < markdownOutput.length; i++) {
    const chunk = markdownOutput[i];
    if (!chunk) continue;

    const oldPath = chunk.metadata.source;
    const newPath = oldPath.slice(
      oldPath.indexOf("/docs") + "/docs".length + 1
    );
    const newPathWithoutExtension = newPath.slice(0, newPath.lastIndexOf("."));
    const newSource = `https://docs.minaprotocol.com/${newPathWithoutExtension}`;
    chunk.metadata.source = newSource;
  }
  return markdownOutput;
}

async function loadIntoPinecone() {
  const markdownOutput = await loadMarkdown();
  const codeOutput = await loadCode();

  const combinedOutput = [...markdownOutput, ...codeOutput];

  await PineconeStore.fromDocuments(combinedOutput, new OpenAIEmbeddings(), {
    pineconeIndex,
  });
  console.log("Persisted to Pinecone! 🌲");
}

async function main() {
  await loadIntoPinecone();
}

await main();
