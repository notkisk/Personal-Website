import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Command {
  input: string;
  output: string[];
  timestamp: Date;
}

interface CatState {
  mood: 'happy' | 'sleepy' | 'surprised' | 'angry' | 'winking';
  isAnimating: boolean;
  speechBubble: string;
  showSpeech: boolean;
}

interface FileSystem {
  [key: string]: {
    type: 'directory' | 'file';
    content?: string[];
    children?: FileSystem;
  };
}

const Terminal = () => {
  const [history, setHistory] = useState<Command[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState('/home/haithem');
  const [showAnimation, setShowAnimation] = useState(false);
  
  // Handle cube rotation animation
  useEffect(() => {
    let animationFrameId: number;
    
    if (showAnimation) {
      const rotateCube = () => {
        setCubeRotation(prev => ({
          x: prev.x + 1,
          y: prev.y + 1
        }));
        animationFrameId = requestAnimationFrame(rotateCube);
      };
      
      animationFrameId = requestAnimationFrame(rotateCube);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showAnimation]);
  
  const [catState, setCatState] = useState<CatState>({
    mood: 'happy',
    isAnimating: false,
    speechBubble: '',
    showSpeech: false
  });
  
  // ASCII Cube variables
  const [cubeFrame, setCubeFrame] = useState('');
  const width = 100;
  const height = 50;
  const zBuffer = useRef<number[]>(new Array(width * height).fill(0));
  const buffer = useRef<string[]>(new Array(width * height).fill(' '));
  const A = useRef(0);
  const B = useRef(0);
  const C = useRef(0);
  const distanceFromCam = 100;
  const K1 = 25;
  const incrementSpeed = 0.015;
  
  // Calculate X coordinate after projection
  const calculateX = (i: number, j: number, k: number) => {
    return j * Math.sin(A.current) * Math.sin(B.current) * Math.cos(C.current) - 
           k * Math.cos(A.current) * Math.sin(B.current) * Math.cos(C.current) +
           j * Math.cos(A.current) * Math.sin(C.current) + 
           k * Math.sin(A.current) * Math.sin(C.current) + 
           i * Math.cos(B.current) * Math.cos(C.current);
  };
  
  // Calculate Y coordinate after projection
  const calculateY = (i: number, j: number, k: number) => {
    return j * Math.cos(A.current) * Math.cos(C.current) + 
           k * Math.sin(A.current) * Math.cos(C.current) -
           j * Math.sin(A.current) * Math.sin(B.current) * Math.sin(C.current) + 
           k * Math.cos(A.current) * Math.sin(B.current) * Math.sin(C.current) -
           i * Math.cos(B.current) * Math.sin(C.current);
  };
  
  // Calculate Z coordinate after projection
  const calculateZ = (i: number, j: number, k: number) => {
    return k * Math.cos(A.current) * Math.cos(B.current) - 
           j * Math.sin(A.current) * Math.cos(B.current) + 
           i * Math.sin(B.current);
  };
  
  // Calculate and render a surface of the cube
  const calculateForSurface = (cubeX: number, cubeY: number, cubeZ: number, ch: string) => {
    const x = calculateX(cubeX, cubeY, cubeZ);
    const y = calculateY(cubeX, cubeY, cubeZ);
    let z = calculateZ(cubeX, cubeY, cubeZ) + distanceFromCam;
    
    if (z === 0) {
      z = 1e-6; // Avoid division by zero
    }
    
    const ooz = 1 / z;
    const xp = Math.floor(width / 2 + K1 * ooz * x * 2);
    const yp = Math.floor(height / 2 + K1 * ooz * y);
    
    const idx = xp + yp * width;
    if (idx >= 0 && idx < width * height) {
      if (ooz > zBuffer.current[idx]) {
        zBuffer.current[idx] = ooz;
        buffer.current[idx] = ch;
      }
    }
  };
  
  // Render the ASCII cube frame
  const renderCubeFrame = () => {
    // Clear the buffer and z-buffer
    buffer.current.fill(' ');
    zBuffer.current.fill(0);
    
    // Rotate the cube
    A.current += incrementSpeed;
    B.current += incrementSpeed;
    C.current += 0.01;
    
    // Render the cube surfaces
    for (let cubeX = -12; cubeX < 12; cubeX += 0.4) {
      for (let cubeY = -12; cubeY < 12; cubeY += 0.4) {
        calculateForSurface(cubeX, cubeY, -12, '@');
        calculateForSurface(12, cubeY, cubeX, '$');
        calculateForSurface(-12, cubeY, -cubeX, '~');
        calculateForSurface(-cubeX, cubeY, 12, '#');
        calculateForSurface(cubeX, -12, -cubeY, ';');
        calculateForSurface(cubeX, 12, cubeY, '+');
      }
    }
    
    // Build the frame string
    let frame = '';
    for (let k = 0; k < width * height; k++) {
      frame += buffer.current[k];
      if (k % width === width - 1) {
        frame += '\n';
      }
    }
    
    setCubeFrame(frame);
  };
  
  // Handle cube animation
  useEffect(() => {
    let animationFrameId: number;
    
    if (showAnimation) {
      const animate = () => {
        renderCubeFrame();
        animationFrameId = requestAnimationFrame(animate);
      };
      
      animationFrameId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showAnimation]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // File system structure
  const fileSystem: FileSystem = {
    home: {
      type: 'directory',
      children: {
        haithem: {
          type: 'directory',
          children: {
            projects: {
              type: 'directory',
              children: {
                parsit: {
                  type: 'directory',
                  children: {
                    'README.md': { type: 'file' },
                    'main.py': { type: 'file' },
                    'requirements.txt': { type: 'file' }
                  }
                },
                'game-dev': {
                  type: 'directory',
                  children: {
                    'unity-projects': { type: 'directory', children: {} },
                    'mobile-games': { type: 'directory', children: {} }
                  }
                },
                'android-apps': {
                  type: 'directory',
                  children: {
                    'app1': { type: 'directory', children: {} },
                    'app2': { type: 'directory', children: {} }
                  }
                }
              }
            },
            documents: {
              type: 'directory',
              children: {
                'resume.pdf': { type: 'file' },
                'portfolio.md': { type: 'file' }
              }
            },
            'skills.txt': { type: 'file' },
            'contact.txt': { type: 'file' }
          }
        }
      }
    }
  };

  const commands = {
    help: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                    AVAILABLE COMMANDS                    ║',
      '╠══════════════════════════════════════════════════════════╣',
      '║ about      - Learn about Haithem Bekkari                ║',
      '║ skills     - View technical skills and expertise         ║',
      '║ projects   - See current and past projects               ║',
      '║ contact    - Get contact information                     ║',
      '║ education  - View educational background                 ║',
      '║ experience - See work experience and clients             ║',
      '║ social     - View social media and professional links    ║',
      '║ parsit     - Learn about current AI project              ║',
      '║ whoami     - Display current user info                   ║',
      '║ pwd        - Show current directory                      ║',
      '║ ls         - List directory contents                     ║',
      '║ cd         - Change directory                            ║',
      '║ matrix     - Launch ASCII matrix animation               ║',
      '║ cat        - Interact with the ASCII cat                 ║',
      '║ pet        - Pet the cat (makes it happy)                ║',
      '║ wake       - Wake up the sleeping cat                    ║',
      '║ scare      - Surprise the cat                            ║',
      '║ clear      - Clear terminal screen                       ║',
      '║ history    - Show command history                        ║',
      '║ date       - Display current date and time               ║',
      '║ exit       - Close terminal session                      ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      'Tip: Use TAB for auto-completion, ↑/↓ for command history'
    ],
    about: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                    HAITHEM BEKKARI                       ║',
      '║                Software Developer & ML Engineer          ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ PROFILE ────────────────────────────────────────────────┐',
      '│                                                          │',
      '│  🎯 Passionate developer with expertise in:              │',
      '│     • Machine Learning & Artificial Intelligence         │',
      '│     • Game Development & Interactive Media               │',
      '│     • Android Application Development                    │',
      '│     • Document Processing & AI Tools                     │',
      '│                                                          │',
      '│  🎓 Computer Science Graduate                             │',
      '│  💼 Experienced Freelance Developer                      │',
      '│  🚀 Currently building: Parsit (AI Document Tool)        │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      'Status: Available for exciting projects and collaborations!'
    ],
    skills: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                   TECHNICAL EXPERTISE                    ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ PROGRAMMING LANGUAGES ─────────────────────────────────┐',
      '│ C#             █████████████████████████  100%          │',
      '│ Python         ████████████████████████   95%           │',
      '│ Kotlin         ████████████████████       65%           │',
      '│ C              ██████████████████         60%           │',
      '│ JavaScript     ███████████████            50%           │',
      '│ TypeScript     ████████████               30%           │',
      '└─────────────────────────────────────────────────────────┘',
      '',
      '┌─ SPECIALIZATIONS ────────────────────────────────────────┐',
      '│ 🤖 Machine Learning & AI                                 │',
      '│    • Neural Networks, Deep Learning                      │',
      '│    • Natural Language Processing                         │',
      '│    • Computer Vision                                     │',
      '│    • Model Training & Deployment                         │',
      '│                                                          │',
      '│ 🎮 Game Development                                       │',
      '│    • Unity Engine                                        │',
      '│    • Game Design & Mechanics                             │',
      '│    • 2D/3D Graphics Programming                          │',
      '│                                                          │',
      '│ 📱 Android Development                                    │',
      '│    • Native Android (Java/Kotlin)                        │',
      '│    • UI/UX Design                                        │',
      '│    • Performance Optimization                            │',
      '└──────────────────────────────────────────────────────────┘'
    ],
    projects: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                    PROJECT PORTFOLIO                     ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ CURRENT PROJECT ────────────────────────────────────────┐',
      '│ 🚀 PARSIT - AI Document Ingestion Tool                   │',
      '│    Status: In Active Development                         │',
      '│    Tech Stack: Python, AI/ML Models, NLP                │',
      '│    Description: Advanced document processing system      │',
      '│    that uses AI to extract, analyze, and structure      │',
      '│    information from various document formats             │',
      '└──────────────────────────────────────────────────────────┘'
    ],
    contact: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                   CONTACT INFORMATION                    ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ GET IN TOUCH ───────────────────────────────────────────┐',
      '│                                                          │',
      '│ 📧 Email: hayetemxd88@gmail.com                          │',
      '│                                                          │',
      '│ 💼 Available for:                                         │',
      '│    • Freelance Development Projects                      │',
      '│    • Machine Learning Consulting                         │',
      '│    • Game Development Collaboration                      │',
      '│    • Android App Development                             │',
      '│    • AI/ML Model Development                             │',
      '│    • Technical Consulting                                │',
      '│                                                          │',
      '│ 🌍 Location: Remote Work Preferred                       │',
      '│ ⏰ Timezone: Flexible scheduling                          │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      'Feel free to reach out for any exciting opportunities!'
    ],
    education: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                 EDUCATIONAL BACKGROUND                   ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ FORMAL EDUCATION ───────────────────────────────────────┐',
      '│                                                          │',
      '│ 🎓 Bachelor\'s Degree in Computer Science                 │',
      '│                                                          │',
      '│    Core Subjects:                                        │',
      '│    • Software Engineering & Design Patterns             │',
      '│    • Data Structures & Algorithms                       │',
      '│    • Database Systems & Management                       │',
      '│    • Mobile Application Development                      │',
      '│    • Software Project Management                         │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      '┌─ CONTINUOUS LEARNING ────────────────────────────────────┐',
      '│ • Advanced ML/AI Courses and Certifications             │',
      '│ • Game Development Workshops                             │',
      '│ • Android Development Best Practices                    │',
      '│ • Open Source Contributions                              │',
      '└──────────────────────────────────────────────────────────┘'
    ],
    experience: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                   WORK EXPERIENCE                        ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ FREELANCE DEVELOPER ────────────────────────────────────┐',
      '│ Duration: Multiple Years                                 │',
      '│ Status: Active                                           │',
      '│                                                          │',
      '│ 🏢 Notable Clients & Platforms:                          │',
      '│                                                          │',
      '│    • Engineering.com                                     │',
      '│      └─ Technical solutions and development              │',
      '│                                                          │',
      '│    • CoolMathGames                                       │',
      '│      └─ Game development and optimization                │',
      '│                                                          │',
      '│    • Various Other Platforms                             │',
      '│      └─ Custom software solutions                        │',
      '│                                                          │',
      '│ 💼 Project Types:                                         │',
      '│    • Full-stack web applications                         │',
      '│    • Mobile game development                             │',
      '│    • Android native applications                         │',
      '│    • Machine learning integrations                      │',
      '│    • AI-powered tools and systems                       │',
      '│    • Performance optimization                            │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      'Proven track record of delivering high-quality solutions!'
    ],
    social: [
      '╔══════════════════════════════════════════════════════════╗',
      '║              PROFESSIONAL & SOCIAL LINKS                 ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ CONTACT INFORMATION ────────────────────────────────────┐',
      '│                                                          │',
      '│ 📧 Email: hayetemxd88@gmail.com                          │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      '┌─ DEVELOPMENT PLATFORMS ──────────────────────────────────┐',
      '│                                                          │',
      '│ 🐙 GitHub                                                │',
      '│    https://github.com/notkisk                            │',
      '│    └─ Open source projects and code repositories         │',
      '│                                                          │',
      '│ 🤗 Hugging Face                                           │',
      '│    https://huggingface.co/nnul                           │',
      '│    └─ AI/ML models and datasets                          │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      '┌─ PROFESSIONAL NETWORK ───────────────────────────────────┐',
      '│                                                          │',
      '│ 💼 LinkedIn                                               │',
      '│    https://linkedin.com/in/haithem-bekkari-6333a1249/   │',
      '│    └─ Professional connections and career updates        │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      'Connect with me to discuss opportunities and collaborations!'
    ],
    parsit: [
      '╔══════════════════════════════════════════════════════════╗',
      '║                      PARSIT PROJECT                      ║',
      '║                AI-Powered Document Ingestion             ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      '┌─ PROJECT OVERVIEW ───────────────────────────────────────┐',
      '│                                                          │',
      '│ 🚀 Status: Currently in Active Development               │',
      '│ 🎯 Goal: Revolutionize document processing with AI       │',
      '│                                                          │',
      '│ 🔧 Core Features:                                         │',
      '│    • Intelligent document parsing                        │',
      '│    • Multi-format support (PDF, DOC, TXT, etc.)         │',
      '│    • AI-powered content extraction                       │',
      '│    • Structured data output                              │',
      '│    • Batch processing capabilities                       │',
      '│    • API integration for seamless workflow               │',
      '│                                                          │',
      '│ 🛠️ Technology Stack:                                      │',
      '│    • Python (Core Development)                           │',
      '│    • Advanced NLP Models                                 │',
      '│    • Machine Learning Pipelines                          │',
      '│    • Document Processing Libraries                       │',
      '│    • Cloud Infrastructure                                │',
      '│                                                          │',
      '│ 💡 Innovation:                                            │',
      '│    Combining traditional document processing with        │',
      '│    cutting-edge AI to create intelligent, context-aware  │',
      '│    document understanding and extraction capabilities.   │',
      '│                                                          │',
      '└──────────────────────────────────────────────────────────┘'
    ],
    whoami: [
      'haithem@portfolio:~$ whoami',
      '',
      '┌─ USER INFORMATION ───────────────────────────────────────┐',
      '│ Name: Haithem Bekkari                                   │',
      '│ Role: Software Developer & ML Engineer                  │',
      '│ Status: Available for Projects                          │',
      '│ Location: Remote                                         │',
      '│ Specialties: ML, Game Dev, Android                      │',
      '└──────────────────────────────────────────────────────────┘',
      '',
      'System uptime: Building innovative solutions since day one'
    ],
    pwd: [],
    ls: [],
    cd: [],
    matrix: [
      'Initializing 3D ASCII Cube...',
      'Starting rotation sequence...',
      '',
      'Press any key or type a command to exit.',
      ''
    ],
    date: [
      new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })
    ],
    history: [],
    exit: [
      'Thank you for visiting my portfolio!',
      '',
      '┌─ SESSION SUMMARY ────────────────────────────────────────┐',
      '│ Hope you enjoyed exploring my terminal portfolio!       │',
      '│ Feel free to reach out for any opportunities.           │',
      '│                                                         │',
      '│ Contact: hayetemxd88@gmail.com                          │',
      '└─────────────────────────────────────────────────────────┘',
      '',
      'Connection closed by remote host.'
    ]
  };

  // ASCII Cat designs for different moods
  const getCatAscii = (mood: string) => {
    switch (mood) {
      case 'happy':
        return [
          '    /\\_/\\  ',
          '   ( ^.^ ) ',
          '    > ^ <  '
        ];
      case 'sleepy':
        return [
          '    /\\_/\\  ',
          '   ( -.- ) ',
          '    > ^ <  '
        ];
      case 'surprised':
        return [
          '    /\\_/\\  ',
          '   ( O.O ) ',
          '    > ^ <  '
        ];
      case 'angry':
        return [
          '    /\\_/\\  ',
          '   ( >.< ) ',
          '    > ^ <  '
        ];
      case 'winking':
        return [
          '    /\\_/\\  ',
          '   ( ^.- ) ',
          '    > ^ <  '
        ];
      default:
        return [
          '    /\\_/\\  ',
          '   ( ^.^ ) ',
          '    > ^ <  '
        ];
    }
  };

  // Cat speech bubbles
  const getCatSpeech = (message: string) => {
    const maxWidth = Math.max(message.length + 4, 12);
    const topBorder = ' ' + '_'.repeat(maxWidth) + ' ';
    const middleLine = `< ${message.padEnd(maxWidth - 2)} >`;
    const bottomBorder = ' ' + '-'.repeat(maxWidth) + ' ';
    const pointer = '    \\   ';
    const pointer2 = '     \\  ';
    
    return [topBorder, middleLine, bottomBorder, pointer, pointer2];
  };

  // Cat interaction handlers
  const handleCatInteraction = (action: string) => {
    let newMood: CatState['mood'] = 'happy';
    let speech = '';
    
    switch (action) {
      case 'pet':
        newMood = 'happy';
        speech = 'Purr purr! *happy*';
        break;
      case 'wake':
        newMood = catState.mood === 'sleepy' ? 'surprised' : 'happy';
        speech = catState.mood === 'sleepy' ? 'Meow! I was sleeping!' : 'I am awake!';
        break;
      case 'scare':
        newMood = 'surprised';
        speech = 'MEOW! You scared me!';
        break;
      case 'click':
        const moods: CatState['mood'][] = ['happy', 'winking', 'sleepy'];
        newMood = moods[Math.floor(Math.random() * moods.length)];
        speech = newMood === 'winking' ? '*wink*' : newMood === 'sleepy' ? 'Zzz...' : 'Meow!';
        break;
      default:
        newMood = 'happy';
        speech = 'Meow! Try: pet, wake, scare';
    }

    setCatState({
      mood: newMood,
      isAnimating: true,
      speechBubble: speech,
      showSpeech: true
    });

    // Hide speech bubble after 3 seconds
    setTimeout(() => {
      setCatState(prev => ({ ...prev, showSpeech: false, isAnimating: false }));
    }, 3000);
  };

  // Get current directory object
  const getCurrentDirectoryObject = useCallback(() => {
    const pathParts = currentDirectory.split('/').filter(part => part !== '');
    let current = fileSystem;
    
    for (const part of pathParts) {
      if (current[part] && current[part].children) {
        current = current[part].children!;
      } else {
        return null;
      }
    }
    return current;
  }, [currentDirectory]);

  // Handle pwd command
  const handlePwd = () => {
    return [currentDirectory];
  };

  // Handle ls command
  const handleLs = () => {
    const currentDir = getCurrentDirectoryObject();
    if (!currentDir) {
      return ['ls: cannot access directory'];
    }

    const items = Object.entries(currentDir).map(([name, item]) => {
      const prefix = item.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--';
      const size = item.type === 'directory' ? '4096' : '1024';
      const date = 'Dec 15 10:30';
      const displayName = item.type === 'directory' ? `${name}/` : name;
      return `${prefix} 1 haithem haithem ${size.padStart(8)} ${date} ${displayName}`;
    });

    return [
      'total ' + Object.keys(currentDir).length,
      ...items
    ];
  };

  // Handle cd command
  const handleCd = (args: string[]) => {
    if (args.length === 0) {
      setCurrentDirectory('/home/haithem');
      return [''];
    }

    const target = args[0];
    let newPath: string;

    if (target === '..') {
      const pathParts = currentDirectory.split('/').filter(part => part !== '');
      if (pathParts.length > 1) {
        pathParts.pop();
        newPath = '/' + pathParts.join('/');
      } else {
        newPath = '/';
      }
    } else if (target.startsWith('/')) {
      newPath = target;
    } else {
      newPath = currentDirectory === '/' ? `/${target}` : `${currentDirectory}/${target}`;
    }

    // Validate path exists
    const pathParts = newPath.split('/').filter(part => part !== '');
    let current = fileSystem;
    
    for (const part of pathParts) {
      if (current[part] && current[part].type === 'directory' && current[part].children) {
        current = current[part].children!;
      } else {
        return [`cd: ${target}: No such file or directory`];
      }
    }

    setCurrentDirectory(newPath);
    return [''];
  };

  // Matrix animation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showAnimation) {
      interval = setInterval(() => {
        // Matrix animation logic would go here
        // For now, we'll just toggle it off after 5 seconds
      }, 100);
      
      // Auto-stop after 5 seconds
      setTimeout(() => {
        setShowAnimation(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showAnimation]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeCommand: Command = {
      input: '',
      output: [
        '╔══════════════════════════════════════════════════════════╗',
        '║              WELCOME TO HAITHEM\'S PORTFOLIO              ║',
        '║                    Terminal Interface                    ║',
        '╚══════════════════════════════════════════════════════════╝',
        '',
        '┌─ SYSTEM INFORMATION ─────────────────────────────────────┐',
        '│ User: Haithem Bekkari                                   │',
        '│ Role: Software Developer & ML Engineer                  │',
        '│ System: Portfolio Terminal v2.0                         │',
        '│ Status: Online and Ready                                │',
        '└──────────────────────────────────────────────────────────┘',
        '',
        'Type "help" to see available commands or start exploring!',
        'Try "matrix" for a cool animation or "cat" to meet my ASCII friend!',
        ''
      ],
      timestamp: new Date()
    };
    setHistory([welcomeCommand]);
  }, []);

  // Cursor blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Scroll to bottom when history updates
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Auto-completion logic
  const getCommandSuggestions = useCallback((input: string) => {
    if (!input) return [];
    const availableCommands = Object.keys(commands);
    return availableCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(input.toLowerCase())
    );
  }, []);

  // Update suggestions when input changes
  useEffect(() => {
    const suggestions = getCommandSuggestions(currentInput);
    setSuggestions(suggestions);
  }, [currentInput, getCommandSuggestions]);

  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    const [command, ...args] = trimmedCmd.toLowerCase().split(' ');
    
    // Add to command history
    if (trimmedCmd && !commandHistory.includes(trimmedCmd)) {
      setCommandHistory(prev => [...prev, trimmedCmd]);
    }
    setHistoryIndex(-1);

    if (command === 'clear') {
      setHistory([]);
      return;
    }

    let output: string[] = [];
    
    if (command === '') {
      output = [''];
    } else if (command === 'pwd') {
      output = handlePwd();
    } else if (command === 'ls') {
      output = handleLs();
    } else if (command === 'cd') {
      output = handleCd(args);
    } else if (command === 'matrix') {
      setShowAnimation(true);
      output = commands.matrix;
    } else if (command === 'cat') {
      handleCatInteraction('click');
      output = [
        'Interactive ASCII Cat Commands:',
        '  pet   - Pet the cat',
        '  wake  - Wake up the cat',
        '  scare - Surprise the cat',
        '',
        'You can also click directly on the cat!'
      ];
    } else if (command === 'pet') {
      handleCatInteraction('pet');
      output = ['You gently pet the cat...'];
    } else if (command === 'wake') {
      handleCatInteraction('wake');
      output = ['You try to wake up the cat...'];
    } else if (command === 'scare') {
      handleCatInteraction('scare');
      output = ['BOO! You scared the cat!'];
    } else if (command === 'history') {
      output = [
        'Command History:',
        '',
        ...commandHistory.map((cmd, index) => `${index + 1}. ${cmd}`)
      ];
    } else if (commands[command as keyof typeof commands]) {
      setIsTyping(true);
      output = commands[command as keyof typeof commands];
      
      // Simulate typing delay for more realistic feel
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsTyping(false);
    } else {
      output = [
        `bash: ${command}: command not found`,
        '',
        'Did you mean one of these?',
        ...getCommandSuggestions(command).map(suggestion => `  ${suggestion}`),
        '',
        'Type "help" to see all available commands.'
      ];
    }

    const newCommand: Command = {
      input: cmd,
      output: output,
      timestamp: new Date()
    };

    setHistory(prev => [...prev, newCommand]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAnimation && e.key !== 'Tab') {
      setShowAnimation(false);
      return;
    }

    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const suggestions = getCommandSuggestions(currentInput);
      if (suggestions.length === 1) {
        setCurrentInput(suggestions[0]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentInput('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    }
  };

  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleAsciiCatClick = () => {
    handleCatInteraction('click');
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPromptPath = () => {
    return currentDirectory.replace('/home/haithem', '~');
  };

  return (
    <div 
      ref={terminalRef}
      className="h-screen bg-black text-green-400 p-4 font-mono text-sm overflow-hidden cursor-text relative"
      onClick={handleTerminalClick}
    >
      {/* True ASCII 3D Cube Animation Overlay */}
      {showAnimation && (
        <div className="fixed inset-0 bg-black z-50 overflow-hidden font-mono text-green-400 flex flex-col items-center justify-center">
          {/* ASCII Cube Container */}
          <pre className="text-xs leading-3 whitespace-pre">
            {cubeFrame}
          </pre>
          
          {/* Exit Instructions */}
          <div className="absolute bottom-8 text-green-500 text-sm font-mono">
            [PRESS ANY KEY TO EXIT]
          </div>
        </div>
      )}

      {/* Terminal Header */}
      <div className="border-b border-green-400 pb-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="ml-4 text-cyan-300 font-bold">haithem@portfolio</span>
            <span className="text-white">:</span>
            <span className="text-blue-400">{getPromptPath()}</span>
          </div>
          <div className="text-green-300 text-xs">
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={outputRef}
        className="h-[calc(100vh-160px)] overflow-y-auto scrollbar-thin scrollbar-thumb-green-400 scrollbar-track-gray-800"
      >
        {history.map((command, index) => (
          <div key={index} className="mb-2">
            {command.input && (
              <div className="flex items-center">
                <span className="text-cyan-300 font-bold">haithem@portfolio</span>
                <span className="text-white">:</span>
                <span className="text-blue-400">{getPromptPath()}</span>
                <span className="text-white">$ </span>
                <span className="text-green-400">{command.input}</span>
                <span className="text-gray-500 text-xs ml-4">
                  [{formatTimestamp(command.timestamp)}]
                </span>
              </div>
            )}
            <div className="mt-1">
              {command.output.map((line, lineIndex) => (
                <div key={lineIndex} className="leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Current Input Line */}
        <div className="flex items-center">
          <span className="text-cyan-300 font-bold">haithem@portfolio</span>
          <span className="text-white">:</span>
          <span className="text-blue-400">{getPromptPath()}</span>
          <span className="text-white">$ </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-green-400 w-full font-mono"
              autoComplete="off"
              spellCheck="false"
              style={{ caretColor: 'transparent' }}
            />
            <span 
              className={`absolute top-0 text-green-400 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100`}
              style={{ 
                left: `${currentInput.length * 0.6}em`,
                pointerEvents: 'none'
              }}
            >
              ▋
            </span>
          </div>
        </div>

        {/* Auto-completion suggestions */}
        {suggestions.length > 0 && currentInput && (
          <div className="mt-2 text-gray-400 text-xs">
            <div>Suggestions:</div>
            <div className="ml-4">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="hover:text-green-400 cursor-pointer">
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}

        {isTyping && (
          <div className="mt-2 text-yellow-400 animate-pulse">
            Processing command...
          </div>
        )}
      </div>

      {/* Fixed Position ASCII Cat */}
      <div className="absolute bottom-20 right-20 cursor-pointer select-none">
        {/* Speech Bubble */}
        {catState.showSpeech && (
          <div className="absolute -top-20 -left-16 text-yellow-300 text-xs font-mono whitespace-pre">
            {getCatSpeech(catState.speechBubble).map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
        
        {/* ASCII Cat */}
        <div 
          className={`text-yellow-400 text-sm font-mono leading-tight transition-all duration-300 hover:scale-110 ${
            catState.isAnimating ? 'animate-bounce' : ''
          }`}
          onClick={handleAsciiCatClick}
        >
          {getCatAscii(catState.mood).map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
        
        {/* Cat interaction hint */}
        {/* Removed "Click me!" hint as it wasn't visible correctly */}
      </div>

      {/* Cat mood indicator */}
      <div className="absolute bottom-4 right-8 text-gray-400 text-xs">
        Cat mood: {catState.mood}
      </div>

      {/* Status Bar */}
      <div className="border-t border-green-400 pt-2 mt-4 text-xs text-green-300 flex justify-between">
        <div>Terminal Ready | Type 'help' for commands | Try 'cat' or 'pet'</div>
        <div>TAB: autocomplete | ↑/↓: history</div>
      </div>
    </div>
  );
};

export default Terminal;