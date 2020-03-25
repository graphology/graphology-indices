/**
 * Graphology Louvain Indices
 * ===========================
 */
var typed = require('mnemonist/utils/typed-arrays');

function LouvainIndex(graph, weightAttribute) {
  var upperBound = graph.directedSize + graph.undirectedSize * 2;

  var PointerArray = typed.getPointerArray(upperBound);

  weightAttribute = weightAttribute || 'weight';

  // NOTE: directedSize + undirectedSize * 2 is an upper bound for
  // neighborhood size
  this.graph = graph;
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);

  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);

  this.nodes = graph.nodes();

  var ids = {};

  var i, l, j, m, node, neighbor, edges, edge, weight;

  var n = 0;

  for (i = 0, l = graph.order; i < l; i++)
    ids[this.nodes[i]] = i;

  for (i = 0, l = graph.order; i < l; i++) {
    node = this.nodes[i];
    edges = graph.outboundEdges(node);

    this.starts[i] = n;
    this.stops[i] = n + edges.length;

    for (j = 0, m = edges.length; j < m; j++) {
      edge = edges[j];
      neighbor = graph.opposite(node, edge);
      weight = graph.getEdgeAttribute(edge, weightAttribute);

      if (typeof weight !== 'number')
        weight = 1;

      // NOTE: for weighted mixed beware of merging weights if twice the same neighbor
      this.neighborhood[n] = ids[neighbor];
      this.weights[n++] = weight;
    }
  }
}

module.exports = LouvainIndex;
