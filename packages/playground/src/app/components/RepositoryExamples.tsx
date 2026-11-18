import { ChevronRight } from "lucide-react";
import { EXAMPLES_REPOSITORY_URL, REPOSITORY_EXAMPLES } from "../examples";

export function RepositoryExamples({
  onLoad,
  isLoading,
}: {
  onLoad: (sourceUrl: string) => void;
  isLoading: boolean;
}) {
  return (
    <section aria-labelledby="repository-examples-title">
      <h3 id="repository-examples-title">Read from the chain</h3>
      <p className="muted">
        Use a connected wallet or the read-only example wallet. These examples
        query the currently selected network; results depend on its address
        activity. They do not sign or broadcast.
      </p>
      {REPOSITORY_EXAMPLES.map((example) => (
        <button
          key={example.file}
          className="example-card"
          disabled={isLoading}
          onClick={() => onLoad(example.sourceUrl)}
        >
          <span>
            <strong>{example.title}</strong>
            <small>{example.description}</small>
          </span>
          <ChevronRight size={20} />
        </button>
      ))}
      <p className="muted">
        Loaded from a tested revision of{" "}
        <a href={EXAMPLES_REPOSITORY_URL} target="_blank" rel="noreferrer">
          CCC repository examples
        </a>
        . Loading requires network access and never runs code. Review the
        fetched source before pressing Run.
      </p>
    </section>
  );
}
