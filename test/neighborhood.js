/**
 * Graphology Indices Unit Tests
 * ==============================
 */
var assert = require('chai').assert;
var Graph = require('graphology');
var outbound = require('../neighborhood/outbound.js');
var louvain = require('../neighborhood/louvain.js');

var OutboundNeighborhoodIndex = outbound.OutboundNeighborhoodIndex;
var WeightedOutboundNeighborhoodIndex = outbound.WeightedOutboundNeighborhoodIndex;

var UndirectedLouvainIndex = louvain.UndirectedLouvainIndex;
var DirectedLouvainIndex = louvain.DirectedLouvainIndex;

var EDGES = [
  [1, 2, 30], // source, target, weight
  [1, 5],
  [2, 3, 15],
  [3, 4, 10],
  [4, 2],
  [5, 1, 5],
  [6, 3, 100]
];

var UNDIRECTED_MOVES = [
  // node '2' to community '2'
  [1, 3, 0, 1, 2],
  // node '1' to community '4'
  [0, 2, 0, 1, 4],
  // node '6' to community '2'
  [5, 1, 0, 1, 2],
  // node '4' to community '2'
  [3, 2, 0, 2, 2]
];

var DIRECTED_MOVES = [
  // node '2' to community '2'
  [1, 2, 1, 0, 0, 0, 1, 2],
  // node '1' to community '4'
  [0, 1, 2, 0, 0, 1, 1, 4],
  // node '6' to community '2'
  [5, 0, 1, 0, 0, 0, 1, 2],
  // node '4' to community '2'
  [3, 1, 1, 0, 0, 1, 1, 2]
];

function fromEdges(GraphConstructor, edges) {
  var g = new GraphConstructor();

  // Adding nodes in order for easier testing
  var nodes = new Set();

  edges.forEach(function(data) {
    nodes.add(data[0]);
    nodes.add(data[1]);
  });

  Array.from(nodes).sort().forEach(function(node) {
    g.addNode(node);
  });

  edges.forEach(function(data) {
    if (data.length === 3)
      g.mergeEdge(data[0], data[1], {weight: data[2]});
    else
      g.mergeEdge(data[0], data[1]);
  });

  return g;
}

function applyMoves(index, moves) {
  moves.forEach(function(move) {
    index.moveNodeToCommunity.apply(index, move);
  });
}

describe('Neighborhood Indices', function() {
  describe('OutboundNeighborhoodIndex', function() {

    it('should properly index the outbound neighborhood of the given graph.', function() {
      var graph = new Graph();
      graph.mergeEdge(1, 2);
      graph.mergeEdge(2, 3);
      graph.mergeEdge(2, 1);
      graph.mergeEdge(4, 5);

      var index = new OutboundNeighborhoodIndex(graph);
      assert.deepEqual(index.neighborhood, new Uint8Array([1, 0, 2, 4]));

      var projection = index.project();

      var neighbors = {};

      graph.forEachNode(function(node) {
        neighbors[node] = graph.outboundNeighbors(node);
      });

      assert.deepEqual(projection, neighbors);

      var results = [0.1, 0.2, 0.3, 0.4, 0.5];

      var resultIndex = {
        1: 0.1,
        2: 0.2,
        3: 0.3,
        4: 0.4,
        5: 0.5
      };

      assert.deepEqual(index.collect(results), resultIndex);

      index.assign('result', results);

      graph.forEachNode(function(node) {
        assert.strictEqual(graph.getNodeAttribute(node, 'result'), resultIndex[node]);
      });
    });

    it('should work with nodes having no edges.', function() {
      var graph = new Graph.UndirectedGraph();
      graph.addNode(1);
      graph.mergeEdge(2, 3);

      var index = new OutboundNeighborhoodIndex(graph);

      assert.deepEqual(index.project(), {
        1: [],
        2: ['3'],
        3: ['2']
      });
      assert.deepEqual(index.neighborhood, new Uint8Array([2, 1]));
      assert.deepEqual(index.starts, new Uint8Array([0, 0, 1, 2]));
    });
  });

  describe('WeightedOutboundNeighborhoodIndex', function() {

    it('should properly index the weighted outbound neighborhood of the given graph.', function() {
      var graph = new Graph();
      graph.mergeEdge(1, 2, {weight: 3});
      graph.mergeEdge(2, 3);
      graph.mergeEdge(2, 1, {weight: 1});
      graph.mergeEdge(4, 5, {weight: 34});

      var index = new WeightedOutboundNeighborhoodIndex(graph);
      assert.deepEqual(index.neighborhood, new Uint8Array([1, 0, 2, 4]));
      assert.deepEqual(index.weights, new Float64Array([3, 1, 1, 34]));

      var projection = index.project();

      var neighbors = {};

      graph.forEachNode(function(node) {
        neighbors[node] = graph.outboundNeighbors(node);
      });

      assert.deepEqual(projection, neighbors);

      var results = [0.1, 0.2, 0.3, 0.4, 0.5];

      var resultIndex = {
        1: 0.1,
        2: 0.2,
        3: 0.3,
        4: 0.4,
        5: 0.5
      };

      assert.deepEqual(index.collect(results), resultIndex);

      index.assign('result', results);

      graph.forEachNode(function(node) {
        assert.strictEqual(graph.getNodeAttribute(node, 'result'), resultIndex[node]);
      });
    });
  });

  describe('LouvainIndex', function() {
    it('should properly index the given undirected graph.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);

      var index = new UndirectedLouvainIndex(graph, {weighted: true});
      // console.log(index);

      assert.strictEqual(index.M, 161);

      assert.deepEqual(index.project(), {
        1: ['2', '5'],
        2: ['1', '3', '4'],
        3: ['2', '4', '6'],
        4: ['2', '3'],
        5: ['1'],
        6: ['3']
      });

      assert.deepEqual(index.neighborhood, new Uint8Array([1, 4, 0, 2, 3, 1, 3, 5, 1, 2, 0, 2]));
      assert.deepEqual(index.weights, new Float64Array([30, 5, 30, 15, 1, 15, 10, 100, 1, 10, 5, 100]));
      assert.deepEqual(index.internalWeights, new Float64Array([0, 0, 0, 0, 0, 0]));
      assert.deepEqual(index.totalWeights, new Float64Array(Array.from(graph.nodes().map(function(node) {
        return graph.edges(node).reduce(function(sum, edge) {
          return sum + (graph.getEdgeAttribute(edge, 'weight') || 1);
        }, 0);
      }))));
    });

    it('should properly index the given directed graph.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);

      var index = new DirectedLouvainIndex(graph, {weighted: true});
      // console.log(index);

      assert.strictEqual(index.M, 162);

      assert.deepEqual(index.project(), {
        1: ['2', '5', '5'],
        2: ['3', '1', '4'],
        3: ['4', '2', '6'],
        4: ['2', '3'],
        5: ['1', '1'],
        6: ['3']
      });

      assert.deepEqual(index.projectOut(), {
        1: ['2', '5'],
        2: ['3'],
        3: ['4'],
        4: ['2'],
        5: ['1'],
        6: ['3']
      });

      assert.deepEqual(index.projectIn(), {
        1: ['5'],
        2: ['1', '4'],
        3: ['2', '6'],
        4: ['3'],
        5: ['1'],
        6: []
      });

      assert.deepEqual(index.neighborhood, new Uint8Array([1, 4, 4, 2, 0, 3, 3, 1, 5, 1, 2, 0, 0, 2]));
      assert.deepEqual(index.weights, new Float64Array([30, 1, 5, 15, 30, 1, 10, 15, 100, 1, 10, 5, 1, 100]));
      assert.deepEqual(index.offsets, new Uint8Array([2, 4, 7, 10, 12, 14]));
      assert.deepEqual(index.internalWeights, new Float64Array([0, 0, 0, 0, 0, 0]));
      assert.deepEqual(index.totalInWeights, new Float64Array(Array.from(graph.nodes().map(function(node) {
        return graph.inEdges(node).reduce(function(sum, edge) {
          return sum + (graph.getEdgeAttribute(edge, 'weight') || 1);
        }, 0);
      }))));
      assert.deepEqual(index.totalOutWeights, new Float64Array(Array.from(graph.nodes().map(function(node) {
        return graph.outEdges(node).reduce(function(sum, edge) {
          return sum + (graph.getEdgeAttribute(edge, 'weight') || 1);
        }, 0);
      }))));
    });

    it('should be possible to move a node from one community to the other in the undirected case.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);
      var index = new UndirectedLouvainIndex(graph);

      var before = {
        belongings: index.belongings.slice(),
        totalWeights: index.totalWeights.slice(),
        internalWeights: index.internalWeights.slice()
      };

      // Null move of node '1'
      index.moveNodeToCommunity(0, 2, 0, 0, 0);

      assert.deepEqual(before, {
        belongings: index.belongings,
        totalWeights: index.totalWeights,
        internalWeights: index.internalWeights
      });

      // Moving node '1' to community of node '2'
      index.moveNodeToCommunity(0, 2, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [1, 1, 2, 3, 4, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [0, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [0, 5, 3, 2, 1, 1]);

      // Rolling back move
      index.moveNodeToCommunity(0, 2, 1, 0, 0);

      assert.deepEqual(before, {
        belongings: index.belongings,
        totalWeights: index.totalWeights,
        internalWeights: index.internalWeights
      });

      // node '3' to community '1'
      index.moveNodeToCommunity(2, 3, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 4, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [0, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [2, 6, 0, 2, 1, 1]);

      // node '5' to community '0'
      index.moveNodeToCommunity(4, 1, 0, 1, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 0, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [3, 6, 0, 2, 0, 1]);

      // node '6' to community '1'
      index.moveNodeToCommunity(5, 1, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 4, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [3, 7, 0, 2, 0, 0]);

      // node '4' to community '1'
      index.moveNodeToCommunity(3, 2, 0, 2, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 8, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [3, 9, 0, 0, 0, 0]);

      // Supplementary node '3' to community '0'
      index.moveNodeToCommunity(2, 3, 3, 0, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 0, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [6, 6, 0, 0, 0, 0]);

      // Supplementary node '2' to community '0'
      index.moveNodeToCommunity(2, 3, 0, 3, 1);
      index.moveNodeToCommunity(1, 3, 2, 1, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 0, 1, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [4, 4, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [6, 6, 0, 0, 0, 0]);
    });

    it('should be possible to move a node from one community to the other in the directed case.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);
      var index = new DirectedLouvainIndex(graph);

      var before = {
        belongings: index.belongings.slice(),
        totalInWeights: index.totalInWeights.slice(),
        totalOutWeights: index.totalOutWeights.slice(),
        internalWeights: index.internalWeights.slice()
      };

      // Null move of node '1'
      index.moveNodeToCommunity(0, 1, 2, 0, 0, 0, 0, 0);

      assert.deepEqual(before, {
        belongings: index.belongings,
        totalInWeights: index.totalInWeights,
        totalOutWeights: index.totalOutWeights,
        internalWeights: index.internalWeights
      });

      // Moving node '1' to community of node '2'
      index.moveNodeToCommunity(0, 1, 2, 0, 0, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [1, 1, 2, 3, 4, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [0, 1, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [0, 3, 2, 1, 1, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [0, 3, 1, 1, 1, 1]);

      // Rolling back move
      index.moveNodeToCommunity(0, 1, 2, 0, 1, 0, 0, 0);

      assert.deepEqual(before, {
        belongings: index.belongings,
        totalInWeights: index.totalInWeights,
        totalOutWeights: index.totalOutWeights,
        internalWeights: index.internalWeights
      });

      // node '3' to community '1'
      index.moveNodeToCommunity(2, 2, 1, 0, 0, 1, 0, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 4, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [0, 1, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [1, 4, 0, 1, 1, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [2, 2, 0, 1, 1, 1]);

      // node '5' to community '0'
      index.moveNodeToCommunity(4, 1, 1, 0, 0, 1, 1, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 0, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 1, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [2, 4, 0, 1, 0, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [3, 2, 0, 1, 0, 1]);

      // node '6' to community '1'
      index.moveNodeToCommunity(5, 0, 1, 0, 0, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 3, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [2, 4, 0, 1, 0, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [3, 3, 0, 1, 0, 0]);

      // node '4' to community '1'
      index.moveNodeToCommunity(3, 1, 1, 0, 0, 1, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 1, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 4, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [2, 5, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [3, 4, 0, 0, 0, 0]);

      // Supplementary node '3' to community '0'
      index.moveNodeToCommunity(2, 2, 1, 2, 1, 0, 0, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 1, 0, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [2, 1, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [4, 3, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [4, 3, 0, 0, 0, 0]);

      // Supplementary node '2' to community '0'
      index.moveNodeToCommunity(2, 2, 1, 0, 0, 2, 1, 1);
      index.moveNodeToCommunity(1, 2, 1, 1, 1, 0, 1, 0);

      assert.deepEqual(Array.from(index.belongings), [0, 0, 1, 1, 0, 1]);
      assert.deepEqual(Array.from(index.internalWeights), [3, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalInWeights), [4, 3, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalOutWeights), [4, 3, 0, 0, 0, 0]);
    });

    it('should be possible to zoom out in the undirected case.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);
      var index = new UndirectedLouvainIndex(graph, {keepDendrogram: true, keepCounts: true});

      assert.deepEqual(index.counts, new Uint8Array([1, 1, 1, 1, 1, 1]));

      // node '1', '5' => community '4' (0)
      // node '2', '3', '4', '6' => community '2' (1)

      // node '2' to community '2'
      index.moveNodeToCommunity(1, 3, 0, 1, 2);

      // node '1' to community '4'
      index.moveNodeToCommunity(0, 2, 0, 1, 4);

      // node '6' to community '2'
      index.moveNodeToCommunity(5, 1, 0, 1, 2);

      // node '4' to community '2'
      index.moveNodeToCommunity(3, 2, 0, 2, 2);

      assert.deepEqual(index.counts, new Uint8Array([0, 0, 4, 0, 2, 0]));
      assert.closeTo(index.computeModularity(), 0.2083, 0.001);

      index.zoomOut();

      assert.closeTo(index.computeModularity(), 0.2083, 0.001);
      assert.deepEqual(index.counts.slice(0, index.C), new Uint8Array([2, 4]));

      assert.strictEqual(index.C, 2);
      assert.strictEqual(index.E, 2);
      assert.strictEqual(index.level, 1);
      assert.deepEqual(index.neighborhood.slice(0, index.C), new Uint8Array([1, 0]));
      assert.deepEqual(index.weights.slice(0, index.C), new Float64Array([1, 1]));
      assert.deepEqual(index.starts.slice(0, index.C + 1), new Uint8Array([0, 1, 2]));
      assert.deepEqual(index.belongings.slice(0, index.C), new Uint8Array([0, 1]));
      assert.deepEqual(index.totalWeights.slice(0, index.C), new Float64Array([3, 9]));
      assert.deepEqual(index.internalWeights.slice(0, index.C), new Float64Array([2, 8]));

      // Once more
      index.moveNodeToCommunity(0, 1, 0, 1, 1);

      assert.deepEqual(index.totalWeights.slice(0, index.C), new Float64Array([0, 12]));
      assert.deepEqual(index.internalWeights.slice(0, index.C), new Float64Array([0, 12]));

      index.zoomOut();

      assert.strictEqual(index.C, 1);
      assert.strictEqual(index.E, 0);
      assert.strictEqual(index.level, 2);

      assert.deepEqual(index.counts.slice(0, index.C), new Uint8Array([6]));

      assert.deepEqual(index.dendrogram, [
        new Uint8Array([0, 1, 2, 3, 4, 5]),
        new Uint8Array([0, 1, 1, 1, 0, 1]),
        new Uint8Array([0, 0, 0, 0, 0, 0])
      ]);

      assert.deepEqual(index.collect(), {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0
      });

      assert.deepEqual(index.collect(0), {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5
      });

      assert.deepEqual(index.collect(1), {
        1: 0,
        2: 1,
        3: 1,
        4: 1,
        5: 0,
        6: 1
      });

      index.assign('community', 1);

      var o = {};

      graph.forEachNode(function(n, attr) {
        o[n] = attr.community;
      });

      assert.deepEqual(o, {
        1: 0,
        2: 1,
        3: 1,
        4: 1,
        5: 0,
        6: 1
      });
    });

    it('should be possible to zoom out in the directed case.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);
      var index = new DirectedLouvainIndex(graph, {keepDendrogram: true, keepCounts: true});

      assert.deepEqual(index.counts, new Uint8Array([1, 1, 1, 1, 1, 1]));

      // node '1', '5' => community '4' (0)
      // node '2', '3', '4', '6' => community '2' (1)

      // node '2' to community '2'
      index.moveNodeToCommunity(1, 2, 1, 0, 0, 0, 1, 2);

      // node '1' to community '4'
      index.moveNodeToCommunity(0, 1, 2, 0, 0, 1, 1, 4);

      // node '6' to community '2'
      index.moveNodeToCommunity(5, 0, 1, 0, 0, 0, 1, 2);

      // node '4' to community '2'
      index.moveNodeToCommunity(3, 1, 1, 0, 0, 1, 1, 2);

      assert.deepEqual(index.counts, new Uint8Array([0, 0, 4, 0, 2, 0]));
      assert.closeTo(index.computeModularity(), 0.3265, 0.001);

      index.zoomOut();

      assert.closeTo(index.computeModularity(), 0.3265, 0.001);
      assert.deepEqual(index.counts.slice(0, index.C), new Uint8Array([2, 4]));

      assert.strictEqual(index.C, 2);
      assert.strictEqual(index.E, 2);
      assert.strictEqual(index.level, 1);
      assert.deepEqual(index.neighborhood.slice(0, index.C), new Uint8Array([1, 0]));
      assert.deepEqual(index.weights.slice(0, index.C), new Float64Array([1, 1]));
      assert.deepEqual(index.starts.slice(0, index.C + 1), new Uint8Array([0, 1, 2]));
      assert.deepEqual(index.belongings.slice(0, index.C), new Uint8Array([0, 1]));
      assert.deepEqual(index.totalInWeights.slice(0, index.C), new Float64Array([2, 5]));
      assert.deepEqual(index.totalOutWeights.slice(0, index.C), new Float64Array([3, 4]));
      assert.deepEqual(index.internalWeights.slice(0, index.C), new Float64Array([2, 4]));

      // Once more
      index.moveNodeToCommunity(0, 0, 1, 0, 0, 0, 1, 1);

      assert.deepEqual(index.totalInWeights.slice(0, index.C), new Float64Array([0, 7]));
      assert.deepEqual(index.totalOutWeights.slice(0, index.C), new Float64Array([0, 7]));
      assert.deepEqual(index.internalWeights.slice(0, index.C), new Float64Array([0, 7]));

      index.zoomOut();

      assert.strictEqual(index.C, 1);
      assert.strictEqual(index.E, 0);
      assert.strictEqual(index.level, 2);

      assert.deepEqual(index.counts.slice(0, index.C), new Uint8Array([6]));

      assert.deepEqual(index.dendrogram, [
        new Uint8Array([0, 1, 2, 3, 4, 5]),
        new Uint8Array([0, 1, 1, 1, 0, 1]),
        new Uint8Array([0, 0, 0, 0, 0, 0])
      ]);

      assert.deepEqual(index.collect(), {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0
      });

      assert.deepEqual(index.collect(0), {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5
      });

      assert.deepEqual(index.collect(1), {
        1: 0,
        2: 1,
        3: 1,
        4: 1,
        5: 0,
        6: 1
      });

      index.assign('community', 1);

      var o = {};

      graph.forEachNode(function(n, attr) {
        o[n] = attr.community;
      });

      assert.deepEqual(o, {
        1: 0,
        2: 1,
        3: 1,
        4: 1,
        5: 0,
        6: 1
      });
    });

    it('should be possible to compute modularity delta in the undirected case.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);
      var index = new UndirectedLouvainIndex(graph);
      applyMoves(index, UNDIRECTED_MOVES);

      // node '2' to community '4'
      var delta = index.computeModularityDelta(3, 1, 4);

      assert.closeTo(delta, 1 / 24, 0.001);

      // node '1' to community '2'
      delta = index.computeModularityDelta(2, 1, 2);

      assert.closeTo(delta, -1 / 12, 0.001);
    });

    it('should be possible to compute modularity delta in the directed case.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);
      var index = new DirectedLouvainIndex(graph);
      applyMoves(index, DIRECTED_MOVES);

      // node '2' to community '4'
      var delta = index.computeModularityDelta(2, 1, 1, 4);

      assert.closeTo(delta, -1 / 49, 0.001);

      // node '1' to community '2'
      delta = index.computeModularityDelta(1, 2, 1, 2);

      assert.closeTo(delta, -1 / 7, 0.001);
    });

    it('modularity delta computations should remain sane in the undirected case.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);
      var index = new UndirectedLouvainIndex(graph);
      applyMoves(index, UNDIRECTED_MOVES);

      var delta = index.computeModularityDelta(3, 1, 4);

      var indexWithIsolatedNode = new UndirectedLouvainIndex(graph);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(0, 4);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(5, 2);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(3, 2);

      var indexWithNodeInOtherCommunity = new UndirectedLouvainIndex(graph);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(1, 4);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(0, 4);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(5, 2);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(3, 2);

      var QIsolated = indexWithIsolatedNode.computeModularity(),
          QWithNodeInOtherCommunity = indexWithNodeInOtherCommunity.computeModularity();

      assert.closeTo(QIsolated + delta, QWithNodeInOtherCommunity, 0.0001);
    });

    it('modularity delta computations should remain sane in the directed case.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);
      var index = new DirectedLouvainIndex(graph);
      applyMoves(index, DIRECTED_MOVES);

      var delta = index.computeModularityDelta(2, 1, 1, 4);

      var indexWithIsolatedNode = new DirectedLouvainIndex(graph);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(0, 4);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(5, 2);
      indexWithIsolatedNode.expensiveMoveNodeToCommunity(3, 2);

      var indexWithNodeInOtherCommunity = new DirectedLouvainIndex(graph);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(1, 4);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(0, 4);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(5, 2);
      indexWithNodeInOtherCommunity.expensiveMoveNodeToCommunity(3, 2);

      var QIsolated = indexWithIsolatedNode.computeModularity(),
          QWithNodeInOtherCommunity = indexWithNodeInOtherCommunity.computeModularity();

      assert.closeTo(QIsolated + delta, QWithNodeInOtherCommunity, 0.0001);
    });
  });
});

// TODO: what if I need to move a node in another community while being the owner of mine?
// TODO: how to isolate a node?
