'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  group: string;
  val: number;
  color: string;
}

interface Link {
  source: string;
  target: string;
  value: number;
  label?: string;
}

const GraphVisualization = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // Sample directed graph data based on the project context
  useEffect(() => {
    const nodes: Node[] = [
      // People
      { id: 'sarah-jenkins', name: 'Sarah Jenkins', group: 'people', val: 25, color: '#FF6B6B' },
      { id: 'priya-sharma', name: 'Priya Sharma', group: 'people', val: 30, color: '#4ECDC4' },
      { id: 'david-chen', name: 'David Chen', group: 'people', val: 25, color: '#45B7D1' },

      // Services
      { id: 'nightingale', name: 'Project Nightingale', group: 'services', val: 35, color: '#96CEB4' },
      { id: 'auth-service', name: 'AuthService', group: 'services', val: 28, color: '#FFEAA7' },
      { id: 'token-refresher', name: 'Token-Refresher', group: 'services', val: 25, color: '#DDA0DD' },

      // Events/Issues
      { id: 'performance-issue', name: 'Performance Issues', group: 'events', val: 20, color: '#FF7675' },
      { id: 'race-condition', name: 'Race Condition', group: 'events', val: 22, color: '#FD79A8' },
      { id: 'redis-fix', name: 'Redis Lock Fix', group: 'events', val: 24, color: '#6C5CE7' }
    ];

    const links: Link[] = [
      // Issue reporting flow
      { source: 'sarah-jenkins', target: 'performance-issue', value: 3, label: 'reports' },
      { source: 'performance-issue', target: 'nightingale', value: 4, label: 'affects' },

      // Investigation flow
      { source: 'performance-issue', target: 'priya-sharma', value: 3, label: 'assigned to' },
      { source: 'priya-sharma', target: 'nightingale', value: 2, label: 'investigates' },
      { source: 'priya-sharma', target: 'auth-service', value: 3, label: 'identifies slow responses' },

      // Service dependencies
      { source: 'auth-service', target: 'token-refresher', value: 4, label: 'depends on' },
      { source: 'token-refresher', target: 'race-condition', value: 4, label: 'contains' },

      // Expert consultation
      { source: 'priya-sharma', target: 'david-chen', value: 3, label: 'asks for help' },
      { source: 'david-chen', target: 'race-condition', value: 3, label: 'explains' },

      // Solution implementation
      { source: 'david-chen', target: 'redis-fix', value: 3, label: 'suggests' },
      { source: 'priya-sharma', target: 'redis-fix', value: 4, label: 'implements' },
      { source: 'redis-fix', target: 'race-condition', value: 4, label: 'resolves' },
      { source: 'redis-fix', target: 'performance-issue', value: 5, label: 'fixes' }
    ];

    setGraphData({ nodes, links });
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 200);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Create nodes and links
    createGraphObjects();

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [graphData]);

  const createGraphObjects = () => {
    if (!sceneRef.current) return;

    // Clear existing objects
    sceneRef.current.children = sceneRef.current.children.filter(child =>
      child.type === 'AmbientLight' || child.type === 'DirectionalLight'
    );

    const nodeObjects: THREE.Mesh[] = [];
    const nodeMap = new Map<string, { node: Node; object: THREE.Mesh; position: THREE.Vector3 }>();

    // Create nodes
    graphData.nodes.forEach((node, index) => {
      // Create node geometry
      const geometry = new THREE.SphereGeometry(node.val / 10, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: node.color,
        transparent: true,
        opacity: 0.8
      });
      const sphere = new THREE.Mesh(geometry, material);

      // Position nodes in a rough circle layout
      const angle = (index / graphData.nodes.length) * Math.PI * 2;
      const radius = 100;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.5;
      const z = (Math.random() - 0.5) * 50;

      sphere.position.set(x, y, z);
      sphere.userData = { node, originalColor: node.color };

      nodeObjects.push(sphere);
      nodeMap.set(node.id, { node, object: sphere, position: sphere.position.clone() });
      sceneRef.current!.add(sphere);
    });

    // Create links
    graphData.links.forEach(link => {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);

      if (sourceNode && targetNode) {
        const geometry = new THREE.BufferGeometry();
        const points = [
          sourceNode.position,
          targetNode.position
        ];
        geometry.setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.3,
          linewidth: link.value
        });

        const line = new THREE.Line(geometry, material);
        sceneRef.current!.add(line);

        // Add arrow for directed graph
        const arrowLength = 5;
        const arrowGeometry = new THREE.ConeGeometry(2, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

        const midpoint = new THREE.Vector3()
          .addVectors(sourceNode.position, targetNode.position)
          .multiplyScalar(0.5);

        arrow.position.copy(midpoint);
        arrow.lookAt(targetNode.position);
        arrow.rotateX(Math.PI / 2);

        sceneRef.current!.add(arrow);
      }
    });

    // Add mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = rendererRef.current!.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const intersects = raycaster.intersectObjects(nodeObjects);

      // Reset all nodes
      nodeObjects.forEach(obj => {
        const material = obj.material as THREE.MeshPhongMaterial;
        material.color.set(obj.userData.originalColor);
        material.emissive.setHex(0x000000);
      });

      if (intersects.length > 0) {
        const intersected = intersects[0].object as THREE.Mesh;
        const material = intersected.material as THREE.MeshPhongMaterial;
        material.emissive.setHex(0x444444);
        document.body.style.cursor = 'pointer';
      } else {
        document.body.style.cursor = 'default';
      }
    };

    const handleMouseClick = (event: MouseEvent) => {
      const rect = rendererRef.current!.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current!);
      const intersects = raycaster.intersectObjects(nodeObjects);

      if (intersects.length > 0) {
        const intersected = intersects[0].object as THREE.Mesh;
        setSelectedNode(intersected.userData.node);

        // Animate camera to focus on selected node
        const targetPosition = intersected.position.clone().multiplyScalar(1.5);
        cameraRef.current!.position.lerp(targetPosition, 0.1);
        cameraRef.current!.lookAt(intersected.position);
      }
    };

    rendererRef.current!.domElement.addEventListener('mousemove', handleMouseMove);
    rendererRef.current!.domElement.addEventListener('click', handleMouseClick);
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Project Nightingale - Issue Resolution Graph
          </h1>
          <p className="text-slate-300 text-lg">
            Interactive 3D visualization of the performance issue investigation and resolution
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-24 right-6 z-10 bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10">
        <h3 className="text-white font-semibold mb-3">Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-400"></div>
            <span className="text-slate-300 text-sm">People</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-400"></div>
            <span className="text-slate-300 text-sm">Services</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-pink-400"></div>
            <span className="text-slate-300 text-sm">Events</span>
          </div>
        </div>
      </div>

      {/* Node Info Panel */}
      {selectedNode && (
        <div className="absolute bottom-6 left-6 z-10 bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10 max-w-md">
          <h3 className="text-white font-semibold mb-2">{selectedNode.name}</h3>
          <p className="text-slate-300 text-sm capitalize">
            Type: <span className="text-blue-400">{selectedNode.group}</span>
          </p>
          <p className="text-slate-300 text-sm">
            Connections: <span className="text-green-400">
              {graphData.links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length}
            </span>
          </p>
          <button
            onClick={() => setSelectedNode(null)}
            className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* 3D Graph */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Controls */}
      <div className="absolute bottom-6 right-6 z-10 flex gap-2">
        <button
          onClick={() => {
            if (cameraRef.current) {
              cameraRef.current.position.set(0, 0, 200);
              cameraRef.current.lookAt(0, 0, 0);
            }
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          Reset View
        </button>
        <button
          onClick={() => setSelectedNode(null)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};

export default function GraphPage() {
  return <GraphVisualization />;
}
