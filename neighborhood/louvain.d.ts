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
  project(): {[key: string]: Array<string>};
  moveNodeToCommunity(
    index: number,
    degree: number,
    currentCommunityDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): void;
  zoomOut(): void;
  computeModularity(): number;
  computeModularityDelta(degree: number, targetCommunityDegree: number, targetCommunity: number): number;
  computeModularityDeltaWithOwnCommunity(degree: number, targetCommunityDegree: number, targetCommunity: number): number;
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
  project(): {[key: string]: Array<string>};
  moveNodeToCommunity(
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
  computeModularity(): number;
  computeModularityDelta(
    inDegree: number,
    outDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): number;
  computeModularityDeltaWithOwnCommunity(
    inDegree: number,
    outDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): number;
}
