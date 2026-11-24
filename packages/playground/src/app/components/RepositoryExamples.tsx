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
    <section aria-label="Repository examples">
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
        Loaded from the{" "}
        <a href={EXAMPLES_REPOSITORY_URL} target="_blank" rel="noreferrer">
          CCC repository’s master branch
        </a>
        . Examples can change; loading requires network access and never runs
        code. Review the fetched source before pressing Run.
      </p>
    </section>
  );
}
