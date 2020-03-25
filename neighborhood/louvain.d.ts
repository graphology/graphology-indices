import Graph from 'graphology-types';

type PointerArray = Uint8Array | Uint16Array | Uint32Array | Float64Array;

type LouvainIndexOptions = {
  attributes: {
    weight: string
  },
  weighted: boolean
}

export default class LouvainIndex {
  constructor(graph: Graph, options?: LouvainIndexOptions);

  M: number;
  C: number;
  graph: Graph;
  neighborhood: PointerArray;
  starts: PointerArray;
  stops: PointerArray;
  nodes: Array<string>;

  bounds(index: number): [number, number];
  project(): {[key: string]: Array<string>};
  moveNodeToCommunityUndirected(
    index: number,
    degree: number,
    currentCommunityDegree: number,
    targetCommunityDegree: number,
    targetCommunity: number
  ): void;
}
