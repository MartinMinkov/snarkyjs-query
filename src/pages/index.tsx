import { type ChangeEvent, useState } from "react";
import Head from "next/head";
import { type NextPage } from "next";
import SyntaxHighlighter from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";

import { api } from "~/utils/api";

import { Spinner } from "~/components/spinner";

const Home: NextPage = () => {
  const mutation = api.query.query.useMutation();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string>("explain");
  // const [sources, setSources] = useState<
  //   {
  //     source: string;
  //   }[]
  // >([]);

  const makeQuery = async () => {
    let query;
    if (selectedOption === "explain") {
      query = `Give a detailed explanation of the following question. Give as much detail as you can provide. Do not write any code examples. ${question}`;
    } else if (selectedOption === "code") {
      query = `Write a TypeScript code example answering the question. Do not use triple ticks for code examples. ${question}`;
    } else {
      return;
    }
    console.log(query);

    try {
      const response = await mutation.mutateAsync({ query });
      console.log(response.parsedQuery);
      const answer = response.parsedQuery.text;
      setAnswer(answer);
    } catch (error) {
      setAnswer("Something went wrong. :(\nPlease try again.");
      console.log(error);
    }

    // TODO: Make this better to navigate
    // const sources = response.parsedQuery.sourceDocuments.map((document) => {
    //   const { metadata } = document;
    //   return {
    //     source: metadata.source,
    //   };
    // });
    // setSources(sources);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.target.value);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await makeQuery();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedOption(event.target.value);
  };

  const handleOnClick = async () => {
    await makeQuery();
  };

  const renderAnswer = () => {
    if (mutation.isLoading) {
      return (
        <div className="mt-12 flex justify-center">
          <Spinner className="h-20 w-20" />
        </div>
      );
    } else {
      const answerKeywords = answer.split("\n");
      const keywordIndex = answerKeywords.findIndex(
        (keyword) =>
          keyword.includes("class") ||
          keyword.includes("let") ||
          keyword.includes("const") ||
          keyword.includes("this") ||
          keyword.includes("```") ||
          keyword.includes("import")
      );
      const semicolonIndex = answerKeywords.findLastIndex(
        (keyword) => keyword.includes(";") || keyword.includes("}")
      );

      if (keywordIndex !== -1 && semicolonIndex !== -1) {
        const answerSnippet = answerKeywords.slice(0, keywordIndex).join(" ");
        const codeSnippet = answerKeywords
          .slice(keywordIndex, semicolonIndex + 1)
          .join("\n")
          .trim();
        return (
          <div className="mt-12 w-1/2">
            <p className="text-2xl">{answerSnippet}</p>
            <SyntaxHighlighter
              language="typescript"
              style={dracula}
              className="text-2xl text-sky-500"
            >
              {codeSnippet}
            </SyntaxHighlighter>
          </div>
        );
      }

      return (
        <div className="mt-12 w-1/2">
          <p className="text-2xl">{answer}</p>
          {/* <ul className="mt-12">
            {sources.map((source) => {
              return (
                <Link key={source.source} href={source.source}>
                  <li className="text-xl hover:text-sky-500">
                    {source.source}
                  </li>
                </Link>
              );
            })}
          </ul> */}
        </div>
      );
    }
  };

  return (
    <>
      <Head>
        <title>SnarkyJS Oracle</title>
        <meta name="description" content="Q&A for SnarkyJS" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] pb-32 text-white">
        <h1 className="text-center text-6xl">Ask a question about SnarkyJS!</h1>
        <div className="mt-12 w-1/2">
          <label htmlFor="question" className="mb-2 block text-xl font-medium ">
            Ask your question
          </label>
          <input
            type="text"
            id="question"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Type here..."
            required
            onChange={onInputChange}
            value={question}
            onKeyDown={(e) => void handleKeyDown(e)}
          />
          <div className="mt-12 flex flex-col gap-8">
            <div className="flex h-5 items-center">
              <div className="flex items-center gap-5">
                <input
                  id="helper-radio"
                  aria-describedby="helper-radio-text"
                  type="radio"
                  value="explain"
                  className="h-4 w-4 border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
                  checked={selectedOption === "explain"}
                  onChange={handleChange}
                />
              </div>
              <div className="ml-2">
                <label htmlFor="helper-radio" className="text-xl font-medium ">
                  Explanation
                </label>
                <p id="helper-radio-text" className="text-md">
                  Explain the following question in a question and answer
                  format.
                </p>
              </div>
            </div>
            <div className="mt-12 flex h-5 items-center sm:mt-8">
              <div className="flex items-center gap-5">
                <input
                  id="helper-radio"
                  aria-describedby="helper-radio-text"
                  type="radio"
                  value="code"
                  className="h-4 w-4 border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
                  checked={selectedOption === "code"}
                  onChange={handleChange}
                />
              </div>
              <div className="ml-2">
                <label htmlFor="helper-radio" className="text-xl font-medium ">
                  Code
                </label>
                <p id="helper-radio-text" className="text-md">
                  Answer with a code example that answers the question.
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          disabled={
            question === "" || selectedOption === "" || mutation.isLoading
          }
          onClick={() => void handleOnClick()}
          className="mt-12 flex w-1/2 items-center justify-center rounded bg-blue-500 p-4 font-bold hover:bg-blue-700 xl:w-1/12"
        >
          Answer
        </button>

        {renderAnswer()}
      </main>
    </>
  );
};

export default Home;
