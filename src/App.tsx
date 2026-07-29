import { FormEvent, useMemo, useState } from 'react';

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

const defaultEndpoint = 'https://vibe-proxy-gqv4.onrender.com/v1/chat/completions';
const defaultModel = 'class-chat-model';
const defaultTokenPlaceholder = 'Enter your API key';

const genres: Array<{ value: Genre; label: string }> = [
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'science-fiction', label: 'Science Fiction' },
  { value: 'romance', label: 'Romance' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'adventure', label: 'Adventure' },
];

const agents = [
  {
    name: 'Story Planner',
    purpose: 'Turn the plot idea into a strong story outline and scene beats.',
    instruction:
      'You are a story planning agent. Create a short, vivid outline for a story based on the genre and plot idea. Keep it structured and scene-oriented.',
  },
  {
    name: 'Story Writer',
    purpose: 'Draft the actual story using the outline as the backbone.',
    instruction:
      'You are a story writing agent. Turn the outline into a complete, compelling story draft that matches the requested genre and plot.',
  },
  {
    name: 'Story Critic',
    purpose: 'Polish the story and deliver the final version.',
    instruction:
      'You are a story critique agent. Improve the draft for pacing, clarity, atmosphere, and emotional impact, then return the final polished story.',
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

export default function App() {
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [token, setToken] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [genre, setGenre] = useState<Genre>('fantasy');
  const [plot, setPlot] = useState('A young thief discovers an ancient map that points to a hidden city beneath the sea.');
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [status, setStatus] = useState('Ready to create a story.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canRun = useMemo(() => {
    return endpoint.trim().length > 0 && token.trim().length > 0 && model.trim().length > 0 && plot.trim().length > 0;
  }, [endpoint, token, model, plot]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('Generating your story...');
    setRuns([]);
    setFinalAnswer('');

    try {
      let previousOutput = `Genre: ${genre}\nPlot: ${plot.trim()}`;
      const nextRuns: AgentRun[] = [];

      for (const agent of agents) {
        setStatus(`${agent.name} is running...`);
        const result = await callChatCompletion({
          endpoint,
          token,
          model,
          messages: [
            {
              role: 'system',
              content: agent.instruction,
            },
            {
              role: 'user',
              content: `Genre: ${genre}\nPlot: ${plot.trim()}\n\nPrevious agent output:\n${previousOutput}`,
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

      setFinalAnswer(previousOutput);
      setStatus('Story complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('Story generation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Story Studio</span>
          <h1>Turn a plot idea into a full story using a multi-agent writing pipeline.</h1>
          <p>
            Choose a genre, describe the plot, and let a planner, writer, and critic collaborate to build the story.
            Your API key stays private and is only used for the request.
          </p>
        </div>

        <div className="status-card">
          <div>
            <span className="status-label">Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span className="status-label">Model</span>
            <strong>{model}</strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <form className="panel controls" onSubmit={handleSubmit}>
          <h2>Story settings</h2>
          <label>
            Endpoint URL
            <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          </label>
          <label>
            API key
            <input
              type="password"
              placeholder={defaultTokenPlaceholder}
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <label>
            Model
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
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
