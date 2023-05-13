import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { type PineconeClient } from "@pinecone-database/pinecone";
import { env } from "~/env.mjs";

const queryResponse = z.object({
  text: z.string(),
  sourceDocuments: z.array(
    z.object({
      pageContent: z.string(),
      metadata: z.object({
        "loc.lines.from": z.number(),
        "loc.lines.to": z.number(),
        source: z.string(),
      }),
    })
  ),
});

export const queryRouter = createTRPCRouter({
  query: publicProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { pinecone } = ctx;
      await pinecone.init({
        apiKey: env.PINECONE_API_KEY,
        environment: env.PINECONE_ENVIRONMENT,
      });
      const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);

      const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings(),
        { pineconeIndex }
      );
      const model = new OpenAI({
        temperature: 0,
        verbose: env.VERBOSE_MODE === "true",
        bestOf: 1,
        maxTokens: -1,
      });
      const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
        returnSourceDocuments: true,
      });

      let parsedQuery;
      const maxRetries = 3;
      const maxTime = 170000; // 17 seconds

      const query = input.query;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await Promise.race([
            chain.call({
              query,
            }),
            new Promise((_, reject) =>
              setTimeout(reject, maxTime, "Request timed out")
            ),
          ]);
          parsedQuery = queryResponse.parse(response);
          break;
        } catch (error) {
          console.error(`Attempt ${i + 1} failed. Retrying...`, error);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1 second before retrying
        }
      }

      if (!parsedQuery) {
        throw new Error("Failed to get a response after 3 attempts");
      }

      return {
        parsedQuery,
      };
    }),
});
