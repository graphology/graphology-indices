import Graph from 'graphology-types';

type PointerArray = Uint8Array | Uint16Array | Uint32Array | Float64Array;

type LouvainIndexOptions = {
  attributes: {
    weight: string
  },
  keepCounts: boolean,
  keepDendrogram: boolean,
  weighted: boolean
}

type CommunityMapping = {[key: string]: number};
type NeighborhoodProjection = {[key: string]: Array<string>};

export class UndirectedLouvainIndex {
  constructor(graph: Graph, options?: LouvainIndexOptions);

  M: number;
  C: number;
  E: number;
  level: number;
  graph: Graph;
  neighborhood: PointerArray;
  starts: PointerArray;
  nodes: Array<string>;

  bounds(index: number): [number, number];
  project(): NeighborhoodProjection;
  move(
    index: number,
    degree: number,
    currentCommunityDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): void;
  zoomOut(): void;
  modularity(): number;
  delta(degree: number, targetCommunityDegree: number, targetCommunity: number): number;
  deltaWithOwnCommunity(degree: number, targetCommunityDegree: number, targetCommunity: number): number;
  trueDelta(
    index: number,
    degree: number,
    currentCommunityDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): number;
  collect(level?: number): CommunityMapping;
  assign(prop: string, level?: number): void;
}

export class DirectedLouvainIndex {
  constructor(graph: Graph, options?: LouvainIndexOptions);

  M: number;
  C: number;
  E: number;
  level: number;
  graph: Graph;
  neighborhood: PointerArray;
  starts: PointerArray;
  offsets: PointerArray;
  nodes: Array<string>;

  bounds(index: number): [number, number];
  inBounds(index: number): [number, number];
  outBounds(index: number): [number, number];
  project(): NeighborhoodProjection;
  projectIn(): NeighborhoodProjection;
  projectOut(): NeighborhoodProjection;
  move(
    index: number,
    inDegree: number,
    outDegree: number,
    currentCommunityInDegree: number,
    currentCommunityOutDegree: number,
    targetCommunityInDegree: number,
    targetCommunityOutDegree: number,
    targetCommunity: number
  ): void;
  zoomOut(): void;
  modularity(): number;
  delta(
    inDegree: number,
    outDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): number;
  deltaWithOwnCommunity(
    inDegree: number,
    outDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): number;
  collect(level?: number): CommunityMapping;
  assign(prop: string, level?: number): void;
}
