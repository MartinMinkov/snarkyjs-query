# SnarkyJS Query

This project is a TypeScript web application that provides a language learning model (LLM) context about SnarkyJS, a library for writing zk-SNARKs in JavaScript and TypeScript. The app is built using Next.js and TRPC and is hosted on Vercel.

It uses OpenAI's language model, ChatGPT-3.5-Turbo, to answer queries about SnarkyJS. The LLM context is retrieved from a Pinecone vector store which stores related SnarkyJS data.

The intended use case for this application is to provide developers learning about SnarkyJS with additional resources and explanations, making it easier for them to understand how to use the library effectively.

## SnarkyJS Data

The Pinecone vector store stores data retrieved from:

- Mina Protocol zkApps documentation
- SnarkyJS source code
- Documentation on the underlying proof systems that SnarkyJS uses
- Various GitHub repositories using SnarkyJS
