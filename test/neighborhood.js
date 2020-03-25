/**
 * Graphology Indices Unit Tests
 * ==============================
 */
var assert = require('assert');
var Graph = require('graphology');
var outbound = require('../neighborhood/outbound.js');
var LouvainIndex = require('../neighborhood/louvain.js');

var OutboundNeighborhoodIndex = outbound.OutboundNeighborhoodIndex;
var WeightedOutboundNeighborhoodIndex = outbound.WeightedOutboundNeighborhoodIndex;

var EDGES = [
  [1, 2, 30], // source, target, weight
  [1, 5],
  [2, 3, 15],
  [3, 4, 10],
  [4, 2],
  [5, 1, 5],
  [6, 3, 100]
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
      assert.deepEqual(index.starts, new Uint8Array([0, 0, 1]));
      assert.deepEqual(index.stops, new Uint8Array([0, 1, 2]));
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

      var index = new LouvainIndex(graph, {weighted: true});
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
    });

    it('should properly index the given directed graph.', function() {
      var graph = fromEdges(Graph.DirectedGraph, EDGES);

      var index = new LouvainIndex(graph, {weighted: true});
      // console.log(index);

      assert.strictEqual(index.M, 162);

      assert.deepEqual(index.project(), {
        1: ['5', '2', '5'],
        2: ['1', '4', '3'],
        3: ['2', '6', '4'],
        4: ['3', '2'],
        5: ['1', '1'],
        6: ['3']
      });

      assert.deepEqual(index.neighborhood, new Uint8Array([4, 1, 4, 0, 3, 2, 1, 5, 3, 2, 1, 0, 0, 2]));
      assert.deepEqual(index.weights, new Float64Array([5, 30, 1, 30, 1, 15, 15, 100, 10, 10, 1, 1, 5, 100]));
      assert.deepEqual(Array.from(index.outs), [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1]);
    });

    it('should be possible to move a node from one community to the other.', function() {
      var graph = fromEdges(Graph.UndirectedGraph, EDGES);
      var index = new LouvainIndex(graph);

      var before = {
        belongings: index.belongings.slice(),
        totalWeights: index.totalWeights.slice(),
        internalWeights: index.internalWeights.slice()
      };

      // Null move of node '1'
      index.moveNodeToCommunityUndirected(0, 2, 0, 0, 0);

      assert.deepEqual(before, {
        belongings: index.belongings,
        totalWeights: index.totalWeights,
        internalWeights: index.internalWeights
      });

      // Moving node '1' to community of node '2'
      index.moveNodeToCommunityUndirected(0, 2, 0, 1, 1);

      assert.deepEqual(Array.from(index.belongings), [1, 1, 2, 3, 4, 5]);
      assert.deepEqual(Array.from(index.internalWeights), [0, 2, 0, 0, 0, 0]);
      assert.deepEqual(Array.from(index.totalWeights), [2, 4, 3, 2, 1, 1]);
    });
  });
});
