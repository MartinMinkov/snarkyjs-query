import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
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
      const pineconeIndex = await pinecone;
      const query = input.query;

      const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings(),
        { pineconeIndex }
      );
      const model = new OpenAI({
        temperature: 0,
        verbose: env.VERBOSE_MODE === "true",
      });
      const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
        returnSourceDocuments: true,
      });

      const response = await chain.call({
        query,
      });
      const parsedQuery = queryResponse.parse(response);

      return {
        parsedQuery,
      };
    }),
});
