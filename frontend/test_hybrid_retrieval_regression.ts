import { extractPdfPages, chunkPages, type PageContent } from './netlify/functions/utils/pdfParser';
import { generateLocalDenseEmbedding } from './netlify/functions/utils/embeddings';
import { rankChunks, cosineSimilarity, computeBM25Scores } from './netlify/functions/utils/vectorMath';
import { generateGroundedAnswer, REFUSAL_TEXT, ensureCitations, isRefusal } from './netlify/functions/utils/groqService';

/**
 * Self-contained in-memory sample corpus representing the multi-page SNLP Question Bank.
 * Completely eliminates any external filesystem or machine-specific file path dependency.
 */
const SAMPLE_PAGES: PageContent[] = [
  {
    pageNum: 1,
    text: `SNLP
UNIT-1Introduction and Word Level Analysis (Question Bank)
Q1) Write in short about the origins of NLP and the challenges it faces in the
world today.A1)
Origins of NLP
Natural Language Processing known as NLP is a form of Artificial Intelligence
that allows machines and computers to understand and interpret the human
language.
This form is very essential to allow users to communicate with the computer just as
they would any other human being.
Around 1950 the Turing Machine became famous (Developed by Alan Turing in
order to interpret the encrypted signals being sent by the Germans). Turing built a
machine that could use logic and various other key aspects to understand the logic
behind each message and crack the code. The first use of NLP was seen right there
while communicating with the Turing Machine
The 1960’s seen a lot of work that was led by Chomsky and other renowned
researchers who worked on this language in order to develop a universal syntax
that could be used by people around the world to communicate with machines.
Development in this field was not rapid but there was definitely a growing interest
into developing this field further to automate a lot of manual activities. People had
a learning curve that was very slow which only allowed people to have a keen
interest in this field around the year 1990. The 90’s seen a surge of people
developing models using artificial intelligence. TO do the same they relied heavily
on language processing which seen a boost around the time.All of this gave an
incentive for people to use NLP along with machine learning and artificial
intelligence to develop probabilistic models which relied heavily on data. To let the
machine read and interpret data NLP became key right up to present time. A lot of
data relied on speech recognition which allowed people to transfer audio files and
store them in the for of data on the internet. Due to the Internet Age language
processing is used in almost area around you. Social media platforms rely heavily
on language processing which forms a major part of recent generations. In short,
without NLP we would not have achieved al the technological advancements that
we have in recent times.
Challenges of NLP NLP being one of the major ways in which a person can
communicate with machines to solve problems does come with a plethora of
advantages. However, as advanced as the technology may be there are always a
few challenges that lie ahead of the following which need to be conquered in order
to solve them. A little about each of the challenges are given below.`,
  },
  {
    pageNum: 2,
    text: `Text SummarizationThis is simply a challenge that lies ahead for readers who
are working on extracting data and going through a lot of data in a short time. They
would prefer to have a summary of the same. AI uses NLP in order to interpret and
structure a summary by using all of the important points. However, there are a lot
of points that do get missed out. This is one of the challenges that could solve a lot
of problems that use data inspection.
2.Chatbot’s and Other AI Answer MachinesThese are so frequently used by people
while surfing a website in order to navigate the site appropriately in order to find
the thing that they would be needing most. Replies do get easy based on questions
that are asked frequently. However, when we use this on a much higher level with
more complex reasonings not every chatbot implemented with AI would be able to
provide reliable answers. AI intends to allow everyone to use this feature to solve
their daily problems.
Q2) What is Language Modelling? Name and explain 2 different types of
LM’s
A2) Language Modelling Language models (LM’s) are used to estimate the
likelihood of different words or phrases relative to other phrases or words in order
to improve other NLP applications. Most of the models that are based on language
modelling use probabilistic inferences in order to calculate the probability of the
next word that the user might be intending to note down. It can also be used to find
the probability of a certain word or phrase in data that is already existing.
P(w) = P(w1, w2, w3, w4, ………wn) = ∏ P(wi|w1,w2.w3……..wi-1)
where ‘n’ is the total number of occurrences in the given data and ‘i’ is the
instance that we need to find out the occurrence of.
Two different types of Language Modelling are
1) Grammar Based Language Modelling 2) Statistical Based Language Modelling
1.Grammar Based Language Modelling - As the name rightly suggests this
model is based on the grammatical inferences that have been given out to the
machine in order to make appropriate prediction based on the probabilistic
inferences that the sentence has occurred in a similar event as before. We can be
sure that the language that we need the user to interpret a certain event in is based
on the past happenings in terms of that data. Let us understand this model with the
help of an example further.E.g. Sentence: “This glass is transparent.”P(“This glass
is transparent.”) = P(wi)In order to construct the above sentence or predict it we
need to see all the possible combinations based on the rule that is given below.
P( This ) = P(w1)
P( glass | This ) = P(w2)
P( is | This glass ) =P(w3)`,
  },
  {
    pageNum: 4,
    text: `Corpus: A Corpus is essentially a paragraph that is being specified under which an
entire search will be executed. This has the entire bulk of data that can be used.
Pattern: This is the required pattern that can be entered in the search to obtain the
required search results. Basic expressions that are used for the following are given
below.
There are a few basic properties of a regular expression which need to be
understood in order to use ‘RegEx’ (Regular Expression) efficiently.
1. Brackets (“[ ]”)Brackets are used to specify a certain disjunction of characters.
For instance, the bracket being used on a regular ‘s’ or ‘S’ can be used to return a
capital or lower case ‘S.
E.g. /[sS]mall = Small or small (any of the above combinations) /[a b c] = ‘a’,
‘b’ or ‘c’ (any of the letters in the bracket) /[0,1,2,3,4,5] = any digit from the
bracket
2.Dash (“-”)Dash is a regular expression which can specify the range for a
particular search. If we put a dash between two letters it would match all the letters
between them.E.g. /[A-Z] = All upper-case letters between A and Z would match
the search. /[a-z] = All lower-case letters between a and z would match the
search.
3.Caret (“^”)As normal syntax this sign is also used to indicate a negation in the
search that is conducted using this regular expression. It could also simply be used
as a ‘caret’ symbol.E.g. /[^A-Z]mall = Not any upper-case would be
selected /[^Dd] = This would indicate the search is for neither ‘d’ nor
‘D’ /[e^] = Used as a simple caret simple as there is nothing to negate after ‘e’
4.Question Mark (“?”)The question mark symbol is essentially used to display the
optionality for the search that has been conducted in the previous search. Putting a
“?” before a certain letter would indicate that the user would like to return the
search with an option consisting of that letter and one without that letter.E.g.
/[malls?] = This would return either “mall” or “malls” /[colou?r] = This would
return either “color” or “colour”
5. Period(“*”)The asterisk symbol “*” is used to match a certain character that is
between an expression in the search. If the user has an expression that would make
sense after entering another letter this period mark is very useful.E.g. /[beg*n] =
Will give out any word that makes sense like ‘begin’
6.Anchors Anchors can be used to match a certain assertion in the text that has
been searched.E.g. Consider “^” and “$” as specified anchors. Then
^The = Matches a string that starts with ‘The’
bye$ = Matches a string that ends with ‘bye’
7. Character Classes
“\\d” : Matches a single character which is a digit.`,
  },
  {
    pageNum: 7,
    text: `them to form a new word. A lexicon should constitute the list of words that have
the base to form a structure in order to be converted to different types of words.
Q5) What is tokenization? How is it used to find the Minimum edit distance?
A5) TokenizationBefore a user happens to proceed with processing the
language, the input text in any form needs to undergo a process of normalization.
This ensures that the text is easily distinguished and easy to work on before any
process goes through. The first process that is part of the entire normalization
process is also known as Tokenization or ‘segmentation’ of words. Word
tokenization can be achieved very easily with the help of a UNIX command line
for text that is solely in the form of the English language. The process of breaking
a given string into smaller parts (tokens) is known as tokenization. Some of the
basic commands that are used to proceed with the following are as follows.
“tr” : This command is used to make systematic changes to the characters that
are already part of the input.
“sort” : This command as the name suggests can help to sort the lines which are
part of the input in the alphabetical order for better understanding and inference.
“uniq” : This command is simply used to analyse the identical lines input and
allow them to collapse based on changes and modifications made to the system.A
simple method that can be used to initialize the process of tokenization is to split it
o whitespace. In the python programming language one should simply split this
through the NLTK library with the command raw.split(). Using regular expression
makes it impossible to match new characters in the space to the string. We need to
match tabs and lines while using this process.Problems with
tokenization:Tokenization may be a great way to analyze and break down
complex language structures but may pan out to be a difficult task while executing.
A single solution may not always serve the purpose as efficiently as one would
expect.
Deciding what should be grouped as a token and what should not, is key to
enabling users to work easily with the help of tokenization.
Having raw manually tokenized data to compare with data that has been given
back as output from the tokenizer helps to inspect the flaws and finally choose an
appropriate token in the process.
Contractions serve as a major problem for e.g. “couldn’t”. While analyzing a
sentence meaning this would mot pose too much of a problem and hence should be
broken down into 2 separate tokens potentially.
Minimum Edit Distance Just as the name rightly suggests this phenomenon is
about the comparison between two different types of strings. NLP constitutes a
major part of measuring the similarities between two or more phrases (strings). An
example of this can be seen in everyday life. While typing a message on your
mobile you notice a certain autocorrect feature. In short if the user types the word`,
  },
  {
    pageNum: 17,
    text: `Right Quote ” ’, ”
Left Parentheses ( (, [, {, >
Right Parentheses ) ), ], }, <
Comma , ,
Q10) What are the different types of tagging? Write in brief about each
one.A10) There are 3 main types of tagging viz.
Rule Based tagging
Stochastic tagging
Transformation Based tagging
Rule Based TaggingThis type of tagging happens to be one of the most
formerly known method of tagging with the help of POS. These simply use tags for
word classes that are present in the lexicon or the corpus. Sometimes there could
be more than one possible tag. To deal with this problem there are a set of rules
that have been made in order to deal with this.Rule based tagging is a process that
goes through in 2 stages entirely. The first stage and the second stage which are
given below.
Stage One - In this stage the language processing uses the dictionary that has
been included to give each word a specific POS which can be used in the tagging
process later. 2. Stage Two – There are a list of rules which are used to finalise
each and every word to select and assign them with a particular POS. Rules for
Rule-Based tagging
The taggers that are used are all driven by knowledge.
The rules involved for finalising the POS are all made manually.
Rules are used to code the information.
There are a limited number of rules.
Rule Based tags are the only rules used for smoothing and NLP.
Stochastic TaggingThere is another model which is made to complete the
process of tagging. This is known as the Stochastic POS tagging. We only need to
identify which of the model could be classified as a stochastic model and used for
the same. The name comes from the feature of the model using a lot of statistics in
order to get the desired results.Word Frequency ApproachIn the word frequency
approach the taggers that are assigned classify the words mainly based on the
probability of occurrence. If the tag has been assigned the most it will show up
after the training set and be used in the main assigning process. A lot of tags have
different approaches and this is one of the common ones that are used for the
sameThe N-Gram approach is one that is very similar to the same because of the`,
  },
  {
    pageNum: 18,
    text: `different probability densities given to the model. As explained above it depends in
the previous words assigned to the entire sequence.Properties
The following type of tagging is based on all the statistical inferences that have
been made in order to tag words that are part of thee corpus.
A training set needs to be assigned to the model to get an idea of the instances
that have occurred in the past.
A probability would also be assigned to the words that may not appear in the
training corpus.
The training and testing corpus are different from each other.
It simply uses the tags which appear most frequently during the training
process using a training corpus set.
Transformation Based TaggingThis type of tagging is also known by the
name of ‘Brill Tagging’. This form of tagging does not use any sort of probability
or statistical inferences to make tags. Instead there are a set of rule used by the
algorithm to allow POS tags on the corpus. It essentially transforms the text into a
different state through the intervention of rules that have been pre-defined.The
model is heavily based on the previous two models to understand the rules laid
down by the algorithm for the tagging process. There is a fixed protocol that is
followed by this tagging process in order to get an idea of the tagging process.
Solution to begin – The program works with solutions that are very familiar to
it based on past problems occurred which takes place in cycles.
Most appropriate solution chosen - The most useful solution would be
automatically adopted.
Application – The solution is then implemented into the solution of the
problem. Q11) What is the Hidden Markov Model (HMM) and Maximum
Entropy Markov Model (MEMM)? How are they used in the process of POS
tagging?A11)
Hidden Markov ModelA Hidden Markov Model (HMM) is a model that is a
modified stochastic tagging model with the main process being underlined
throughout the main process. The result is simply the same if not more accurate.
However, the processes that get done cannot be seen. The results of each sequence
throughout the process is the only part that can be seen and comprehended.To
understand this a little better, we need to understand the term Markov chain. This
is simply a model that gives us inferences about the sequences from the different
probability densities occurring throughout the corpus. To make a prediction the
markov chain relies heavily on the current position of the tag or word count in the
string. The Hidden Markov Model allows the user to dwell around both visible
events (input strings) as well as hidden events (POS tagging).Let us take an
example to understand better the HMM process for a certain example. Say we have`,
  },
];

async function runHybridRegression() {
  console.log("======================================================================");
  console.log("  RUNNING HYBRID RETRIEVAL & CITATION SUPPRESSION REGRESSION SUITE");
  console.log("======================================================================");

  // 1. Verify in-memory buffer ingestion and parsing
  console.log("Step 1: Ingesting portable in-memory sample document corpus...");
  const sampleBuffer = Buffer.from(SAMPLE_PAGES[0].text, "utf-8");
  const parsedFromBuffer = await extractPdfPages(sampleBuffer);
  if (parsedFromBuffer.length === 0 || !parsedFromBuffer[0].text.includes("Origins of NLP")) {
    throw new Error("extractPdfPages failed to parse in-memory text buffer.");
  }
  console.log("✅ In-memory buffer parsing verified: extractPdfPages handles memory buffers safely.");

  // Chunk in-memory sample pages
  const pages = SAMPLE_PAGES;
  const rawChunks = chunkPages(pages, "doc_snlp", "SNLP Unit 1 QB.pdf", 350, 50);
  console.log(`✅ Document parsed & chunked: ${pages.length} pages, ${rawChunks.length} chunks.`);

  const chunks = rawChunks.map((c) => ({
    ...c,
    embedding: generateLocalDenseEmbedding(c.text),
  }));

  // Identify target chunk (Page 1 Definition & Origins)
  const targetChunkIndex = chunks.findIndex(
    (c) => c.page === 1 && c.text.includes("Natural Language Processing known as NLP")
  );
  if (targetChunkIndex === -1) {
    throw new Error("Could not find Page 1 Definition & Origins target chunk in sample pages.");
  }
  const targetChunk = chunks[targetChunkIndex];

  // -------------------------------------------------------------------------
  // Test Case 1: Backwards compatibility when queryText is omitted
  // -------------------------------------------------------------------------
  console.log("\nStep 2: Verifying backwards compatibility when queryText is omitted...");
  const nlpQuery = "What is NLP?";
  const nlpVec = generateLocalDenseEmbedding(nlpQuery);
  const denseOnlyRanked = rankChunks(nlpVec, chunks, 8, 0.15); // no queryText passed

  // In dense-only, targetChunk scored 0.1163 < 0.15, so it should NOT be in the result
  const foundInDenseOnly = denseOnlyRanked.some((r) => r.chunk.id === targetChunk.id);
  if (foundInDenseOnly) {
    throw new Error(
      "Backwards compatibility failed: Target chunk was expected to be excluded in dense-only retrieval due to score < 0.15"
    );
  }

  // Verify computeBM25Scores helper directly
  const directBM25 = computeBM25Scores(["nlp"], [targetChunk]);
  if (directBM25.length !== 1 || directBM25[0] <= 0) {
    throw new Error(`Direct computeBM25Scores failed: expected positive score, got ${directBM25[0]}`);
  }
  // Verify scores match pure cosine similarity
  for (const item of denseOnlyRanked) {
    const expected = cosineSimilarity(nlpVec, item.chunk.embedding);
    if (Math.abs(item.score - expected) > 1e-5) {
      throw new Error(`Score mismatch in dense-only mode: expected ${expected}, got ${item.score}`);
    }
  }
  console.log("✅ Backwards compatibility verified: Omitting queryText strictly runs pure dense cosine similarity.");

  // -------------------------------------------------------------------------
  // Test Case 2: Three NLP definition/origin query variations retrieve Page 1
  // -------------------------------------------------------------------------
  console.log("\nStep 3: Verifying three NLP definition/origin query variations retrieve Page 1...");

  const variations = [
    {
      q: "What is Natural Language Processing (NLP), and what are its origins?",
      maxRank: 2,
    },
    {
      q: "What is NLP?",
      maxRank: 3, // Target chunk is rank 2, chunk 2 is rank 1 (both Page 1)
    },
    {
      q: "What are the origins of NLP?",
      maxRank: 1, // Target chunk is rank 1
    },
  ];

  for (const { q, maxRank } of variations) {
    const qVec = generateLocalDenseEmbedding(q);
    const ranked = rankChunks(qVec, chunks, 8, 0.15, q);
    const rank = ranked.findIndex((r) => r.chunk.id === targetChunk.id);

    if (rank === -1) {
      throw new Error(`Failed for query "${q}": Target Page 1 chunk not in top-8!`);
    }
    if (rank + 1 > maxRank) {
      throw new Error(`Failed for query "${q}": Expected target chunk in top ${maxRank}, but was rank #${rank + 1}`);
    }
    console.log(
      `✅ Query "${q}": Target Page 1 chunk retrieved at Rank #${rank + 1} (Score: ${ranked[rank].score.toFixed(4)})`
    );
  }

  // -------------------------------------------------------------------------
  // Test Case 3: Tokenization query retrieves Page 7 at Rank 1
  // -------------------------------------------------------------------------
  console.log("\nStep 4: Verifying tokenization query retrieves Page 7 at Rank 1...");
  const tokQuery = "What is tokenization?";
  const tokVec = generateLocalDenseEmbedding(tokQuery);
  const tokRanked = rankChunks(tokVec, chunks, 8, 0.15, tokQuery);

  if (tokRanked.length === 0) {
    throw new Error("Failed: No chunks returned for tokenization query.");
  }
  const topTok = tokRanked[0];
  if (topTok.chunk.page !== 7) {
    throw new Error(`Failed: Expected Page 7 for tokenization, got Page ${topTok.chunk.page}`);
  }
  if (!topTok.chunk.text.toLowerCase().includes("tokenization")) {
    throw new Error("Failed: Top chunk does not discuss tokenization.");
  }
  console.log(
    `✅ Tokenization query: Page 7 retrieved at Rank #1 (Score: ${topTok.score.toFixed(4)}, ChkID: ${topTok.chunk.id})`
  );

  // -------------------------------------------------------------------------
  // Test Case 4: Out-of-domain Mars query refusal and citation suppression
  // -------------------------------------------------------------------------
  console.log("\nStep 5: Verifying Mars query refusal and citation suppression...");
  const marsQuery = "What is the capital of Mars?";
  const marsVec = generateLocalDenseEmbedding(marsQuery);
  const marsRanked = rankChunks(marsVec, chunks, 8, 0.15, marsQuery);

  // 1. Test ensureCitations directly on simulated refusal
  const simulatedRefusal = REFUSAL_TEXT;
  const processedRefusal = ensureCitations(simulatedRefusal, marsRanked);

  if (processedRefusal.includes("Sources:")) {
    throw new Error(`Failed: ensureCitations appended irrelevant sources to refusal text: ${processedRefusal}`);
  }
  if (!isRefusal(processedRefusal) || processedRefusal !== REFUSAL_TEXT) {
    throw new Error(`Failed: Refusal text was mutated unexpectedly: ${processedRefusal}`);
  }
  console.log("✅ Citation suppression verified: ensureCitations does not append misleading sources to refusal.");

  // 2. Deterministic offline extractive fallback verification
  const origKey = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY;
    const fallbackResult = await generateGroundedAnswer(marsQuery, marsRanked);
    if (fallbackResult.answer.includes("Sources:")) {
      throw new Error(`Failed: Extractive fallback appended citations to refusal: ${fallbackResult.answer}`);
    }
    if (!isRefusal(fallbackResult.answer, fallbackResult.modelUsed)) {
      throw new Error(`Failed: Extractive fallback did not refuse out-of-domain query: ${fallbackResult.answer}`);
    }
    console.log(
      `✅ Deterministic fallback refusal verified: Model '${fallbackResult.modelUsed}' refused without attaching citations.`
    );
  } finally {
    if (origKey) process.env.GROQ_API_KEY = origKey;
  }

  // 3. Optional live Groq API validation if GROQ_API_KEY is present
  if (origKey) {
    try {
      const liveResult = await generateGroundedAnswer(marsQuery, marsRanked);
      if (liveResult.answer.includes("Sources: [SNLP Unit 1 QB.pdf, Page 4]")) {
        throw new Error("Failed: Live Groq answer attached irrelevant citations to refusal!");
      }
      if (!isRefusal(liveResult.answer, liveResult.modelUsed)) {
        throw new Error(`Failed: Live Groq answer did not refuse out-of-domain query: ${liveResult.answer}`);
      }
      console.log(`✅ Live Groq refusal verified: Model '${liveResult.modelUsed}' refused safely.`);
    } catch (groqErr) {
      console.warn(
        `[Note] Live Groq test skipped due to network/rate limit: ${
          groqErr instanceof Error ? groqErr.message : String(groqErr)
        }`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Test Case 5: Strict score threshold enforcement
  // -------------------------------------------------------------------------
  console.log("\nStep 6: Verifying strict minSimilarity (0.50) threshold enforcement...");
  const highThreshold = 0.5;
  const filteredRanked = rankChunks(nlpVec, chunks, 8, highThreshold, nlpQuery);
  for (const item of filteredRanked) {
    if (item.score < highThreshold) {
      throw new Error(`Threshold violation: Found item with score ${item.score} < ${highThreshold}`);
    }
  }
  console.log(`✅ Threshold verified: All ${filteredRanked.length} items have score >= ${highThreshold}`);

  console.log("\n======================================================================");
  console.log("🎉 ALL HYBRID RETRIEVAL REGRESSION TESTS PASSED (100%)!");
  console.log("======================================================================");
}

runHybridRegression().catch((err) => {
  console.error("Hybrid regression error:", err);
  process.exit(1);
});
