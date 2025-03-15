/* eslint-disable @typescript-eslint/no-explicit-any */
import { topologySort } from "../src/topologySort";

test("Topological sort should return an empty array for an empty graph", () => {
  const graph = [] as any[];
  const result = topologySort(graph);
  expect(result).toEqual([]);
});

test("Topological sort should return the correct order for a simple acyclic graph", () => {
  const graph = [
    { id: 1, dependencies: [] },
    { id: 2, dependencies: [1] },
    { id: 3, dependencies: [1] },
    { id: 4, dependencies: [2, 3] },
    { id: 5, dependencies: [4] },
  ];
  const result = topologySort(graph);
  expect(result.map((node) => node.id)).toEqual([1, 2, 3, 4, 5]);
});

test("Topological sort should throw an error for a graph with circular dependencies", () => {
  const graph = [
    { id: 1, dependencies: [2] },
    { id: 2, dependencies: [3] },
    { id: 3, dependencies: [1] },
  ];
  expect(() => topologySort(graph)).toThrow(
    "Circular dependency detected: 1 -> 2 -> 3 -> 1",
  );
});

test("Topological sort should throw an error for a graph with missing dependencies", () => {
  const graph = [
    { id: 1, dependencies: [2] },
    { id: 3, dependencies: [4] },
  ];
  expect(() => topologySort(graph)).toThrow("Dependency not found: 2");
});

test("Topological sort should return the correct order for a simple acyclic graph with custom structure", () => {
  type File = {
    name: string;
    imports: string[];
  };

  const files: File[] = [
    { name: "file1", imports: ["file2"] },
    { name: "file2", imports: [] },
    { name: "file3", imports: ["file1"] },
    { name: "file4", imports: ["file2", "file3"] },
    { name: "file5", imports: ["file4"] },
    { name: "file6", imports: ["file3"] },
  ];

  const result = topologySort(files, (file) => ({
    id: file.name,
    dependencies: file.imports,
  }));

  const sortedFileNames = result.map((node) => node.name);

  expect(sortedFileNames).toEqual([
    "file2",
    "file1",
    "file3",
    "file4",
    "file5",
    "file6",
  ]);
});
