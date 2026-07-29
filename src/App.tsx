import { FormEvent, useState } from 'react';

type AgentRun = {
  name: string;
  purpose: string;
  prompt: string;
  output: string;
};

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type Genre = 'fantasy' | 'science-fiction' | 'romance' | 'thriller' | 'mystery' | 'adventure';

const API_ENDPOINT = 'https://vibe-proxy-gqv4.onrender.com/v1/chat/completions';
const API_MODEL = 'class-chat-model';
const API_BEARER_TOKEN = 'sk-vibe-summer-2026';
const PAGE_SIZE = 900;
const MIN_STORY_WORDS = 8000;

const genres: Array<{ value: Genre; label: string }> = [
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'science-fiction', label: 'Science Fiction' },
  { value: 'romance', label: 'Romance' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'adventure', label: 'Adventure' },
];

const randomStorySeeds: Array<{ genre: Genre; plot: string }> = [
  {
    genre: 'fantasy',
    plot: 'A lighthouse keeper discovers the sea answers in riddles every new moon, each one predicting a village secret.',
  },
  {
    genre: 'science-fiction',
    plot: 'On a generation ship, a maintenance coder finds an impossible signal that appears to be sent by her own future self.',
  },
  {
    genre: 'romance',
    plot: 'Two rival bookstore owners keep exchanging anonymous recommendation notes and slowly fall in love without realizing who the other is.',
  },
  {
    genre: 'thriller',
    plot: 'A forensic accountant follows a tiny accounting error that leads to a hidden syndicate and a list with her name on it.',
  },
  {
    genre: 'mystery',
    plot: 'A watchmaker is found dead in a locked shop, and every clock in town stops at a different minute tied to an old case.',
  },
  {
    genre: 'adventure',
    plot: 'A courier carrying a sealed map is chased across deserts, cliffs, and floating ruins by three factions seeking a lost sky city.',
  },
];

const agents = [
  {
    name: 'Story Planner',
    purpose: 'Turn the plot idea into a strong story outline and scene beats.',
    instruction:
      'You are a story planning agent. Build a scene-by-scene outline that is purely and strictly in the requested genre. Do not blend in any other genre conventions.',
  },
  {
    name: 'Story Writer',
    purpose: 'Draft the actual story using the outline as the backbone.',
    instruction:
      `You are a story writing agent. Turn the outline into a complete long-form story draft. Keep it purely in the requested genre with no cross-genre drift. Target at least ${MIN_STORY_WORDS} words.`,
  },
  {
    name: 'Story Critic',
    purpose: 'Polish the story and deliver the final version.',
    instruction:
      `You are a story critique agent. Improve pacing, clarity, atmosphere, and emotional impact while keeping the story purely in the requested genre. Return a polished final story with at least ${MIN_STORY_WORDS} words.`,
  },
];

async function callChatCompletion({
  endpoint,
  token,
  model,
  messages,
}: {
  endpoint: string;
  token: string;
  model: string;
  messages: Message[];
}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as ChatCompletionResponse;
}

function normalizeContent(value: string | undefined) {
  return value?.trim() || 'No story content returned by the model.';
}

function countWords(text: string) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

function ensureChapterOneStart(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^(#\s*)?chapter\s*(one|1)\b/i.test(trimmed)) {
    return trimmed;
  }

  return `Chapter One\n\n${trimmed}`;
}

function splitIntoPages(text: string, maxChars = PAGE_SIZE) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [] as string[];
  }

  const paragraphs = trimmed.split(/\n\s*\n/);
  const pages: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) {
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      pages.push(current);
    }

    if (block.length <= maxChars) {
      current = block;
      continue;
    }

    let remaining = block;
    while (remaining.length > maxChars) {
      const slice = remaining.slice(0, maxChars);
      const splitAt = slice.lastIndexOf(' ');
      const boundary = splitAt > 0 ? splitAt : maxChars;
      pages.push(remaining.slice(0, boundary).trim());
      remaining = remaining.slice(boundary).trim();
    }
    current = remaining;
  }

  if (current) {
    pages.push(current);
  }

  return pages;
}

export default function App() {
  const [genre, setGenre] = useState<Genre>('fantasy');
  const [plot, setPlot] = useState('A young thief discovers an ancient map that points to a hidden city beneath the sea.');
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [status, setStatus] = useState('Ready to create a story.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'left' | 'right'>('right');

  const canRun = plot.trim().length > 0;

  function handleRandomStory() {
    const seed = randomStorySeeds[Math.floor(Math.random() * randomStorySeeds.length)];
    setGenre(seed.genre);
    setPlot(seed.plot);
    setRuns([]);
    setFinalAnswer('');
    setCurrentPage(0);
    setStatus('Random story idea loaded.');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('Generating your story...');
    setRuns([]);
    setFinalAnswer('');
    setCurrentPage(0);

    try {
      let previousOutput = `Genre: ${genre}\nPlot: ${plot.trim()}`;
      const nextRuns: AgentRun[] = [];

      for (const agent of agents) {
        setStatus(`${agent.name} is running...`);
        const result = await callChatCompletion({
          endpoint: API_ENDPOINT,
          token: API_BEARER_TOKEN,
          model: API_MODEL,
          messages: [
            {
              role: 'user',
              content:
                `Agent role: ${agent.name}\nInstruction: ${agent.instruction}\n` +
                `Hard rules:\n- Stay purely in genre: ${genre}\n- No genre mixing\n` +
                `- Keep strong genre tone in every scene\n` +
                `- Story must start with the exact heading: Chapter One\n` +
                `- Final story must be at least ${MIN_STORY_WORDS} words\n\n` +
                `Genre: ${genre}\nPlot: ${plot.trim()}\n\nPrevious agent output:\n${previousOutput}`,
            },
          ],
        });

        const output = normalizeContent(result.choices?.[0]?.message?.content);
        const run = {
          name: agent.name,
          purpose: agent.purpose,
          prompt: previousOutput,
          output,
        } satisfies AgentRun;
        nextRuns.push(run);
        previousOutput = output;
        setRuns([...nextRuns]);
      }

      if (countWords(previousOutput) < MIN_STORY_WORDS) {
        setStatus('Extending story length...');
        const expansion = await callChatCompletion({
          endpoint: API_ENDPOINT,
          token: API_BEARER_TOKEN,
          model: API_MODEL,
          messages: [
            {
              role: 'user',
              content:
                `Expand and continue this story to at least ${MIN_STORY_WORDS} words total.\n` +
                `Hard rules:\n- Keep it purely in genre: ${genre}\n- No genre blending\n` +
                `- Start the story with the exact heading: Chapter One\n` +
                `- Preserve existing characters, plot continuity, and tone\n\n` +
                `Current story:\n${previousOutput}`,
            },
          ],
        });

        const expandedStory = normalizeContent(expansion.choices?.[0]?.message?.content);
        previousOutput = expandedStory;
      }

      setFinalAnswer(ensureChapterOneStart(previousOutput));
      setStatus('Story complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('Story generation failed.');
    } finally {
      setLoading(false);
    }
  }

  const pages = splitIntoPages(finalAnswer);
  const hasStory = pages.length > 0;

  function goToPreviousPage() {
    if (currentPage <= 0) {
      return;
    }
    setFlipDirection('left');
    setCurrentPage((page) => page - 1);
  }

  function goToNextPage() {
    if (currentPage >= pages.length - 1) {
      return;
    }
    setFlipDirection('right');
    setCurrentPage((page) => page + 1);
  }

  return (
    <main className="shell">
      <section className="panel story-book-section">
        <div className="story-header">
          <h2>Finished Story</h2>
          {hasStory ? (
            <p>
              Page {currentPage + 1} of {pages.length}
            </p>
          ) : (
            <p>Your story will appear here first after generation.</p>
          )}
        </div>

        <div className="book-stage">
          <div className={`book-page flip-${flipDirection}`} key={`${currentPage}-${flipDirection}`}>
            {hasStory ? pages[currentPage] : 'No story yet. Fill in genre and plot, then generate.'}
          </div>
        </div>

        <div className="book-controls">
          <button type="button" onClick={goToPreviousPage} disabled={!hasStory || currentPage === 0}>
            Previous page
          </button>
          <button type="button" onClick={goToNextPage} disabled={!hasStory || currentPage >= pages.length - 1}>
            Next page
          </button>
        </div>
      </section>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Story Studio</span>
          <h1>Bright story lab with a multi-agent writing team.</h1>
          <p>
            Choose a genre, describe your plot, and let planner, writer, and critic agents craft your final story.
            The finished story is shown in a page-flip book at the top.
          </p>
        </div>

        <div className="status-card">
          <div>
            <span className="status-label">Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span className="status-label">Model</span>
            <strong>{API_MODEL}</strong>
          </div>
        </div>
      </section>

      <section className="panel art-strip">
        <article className="art-card">
          <img
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%25' height='100%25' fill='%23fff3bf'/><circle cx='110' cy='90' r='64' fill='%23f59f00'/><path d='M0 260 Q140 200 280 250 T640 240 V360 H0 Z' fill='%2322b8cf'/><path d='M0 300 Q170 250 330 295 T640 290 V360 H0 Z' fill='%2312b886'/></svg>"
            alt="Warm illustrated landscape"
          />
          <p>Worldbuilding sparks</p>
        </article>
        <article className="art-card">
          <img
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%25' height='100%25' fill='%23e7f5ff'/><rect x='130' y='90' width='380' height='220' rx='20' fill='%23a5d8ff'/><rect x='160' y='120' width='150' height='160' rx='12' fill='%231977d2'/><rect x='330' y='120' width='150' height='160' rx='12' fill='%2366d9e8'/><line x1='320' y1='120' x2='320' y2='280' stroke='%23ffffff' stroke-width='6'/></svg>"
            alt="Open book illustration"
          />
          <p>Plot in motion</p>
        </article>
        <article className="art-card">
          <img
            src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%25' height='100%25' fill='%23fff0f6'/><path d='M40 300 L190 120 L330 300 Z' fill='%23faa2c1'/><path d='M260 300 L410 80 L600 300 Z' fill='%23f06595'/><circle cx='500' cy='85' r='35' fill='%23ffdeeb'/></svg>"
            alt="Dramatic mountain silhouette"
          />
          <p>Scene inspiration</p>
        </article>
      </section>

      <section className="workspace">
        <form className="panel controls" onSubmit={handleSubmit}>
          <h2>Create Story</h2>
          <label>
            Genre
            <select value={genre} onChange={(event) => setGenre(event.target.value as Genre)}>
              {genres.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plot
            <textarea value={plot} onChange={(event) => setPlot(event.target.value)} rows={7} />
          </label>
          <button type="submit" disabled={!canRun || loading}>
            {loading ? 'Writing story...' : 'Generate story'}
          </button>
          <button type="button" onClick={handleRandomStory} disabled={loading}>
            Random story
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="panel transcript">
          <h2>Agent trace</h2>
          {runs.length === 0 ? (
            <p className="empty-state">Run the story pipeline to see each agent’s contribution appear here.</p>
          ) : (
            <div className="agent-list">
              {runs.map((run) => (
                <article key={run.name} className="agent-card">
                  <div className="agent-header">
                    <div>
                      <h3>{run.name}</h3>
                      <p>{run.purpose}</p>
                    </div>
                  </div>
                  <div className="agent-block">
                    <span>Input context</span>
                    <p>{run.prompt}</p>
                  </div>
                  <div className="agent-block">
                    <span>Output</span>
                    <p>{run.output}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel final-answer">
        <h2>Final story</h2>
        <p>{finalAnswer || 'Your completed story will appear here after the critic pass.'}</p>
      </section>
    </main>
  );
}
