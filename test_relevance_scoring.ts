#!/usr/bin/env node

/**
 * Test script for relevance scoring functionality
 * This script tests the calculateRelevanceScore function with sample job data
 */

// Mock the calculateRelevanceScore function (copy from scraper.ts for testing)
function calculateRelevanceScore(title: string, description: string, company: string, targetRole: string): {
  score: number;
  matchedKeywords: string[];
  filteredReason?: string;
} {
  // Define comprehensive embedded systems keywords
  const embeddedSystemsKeywords = [
    // Core embedded terms
    'embedded systems', 'embedded software', 'embedded firmware', 'embedded development',
    'firmware development', 'firmware engineer', 'driver development', 'bootloader',
    
    // Hardware platforms
    'microcontroller', 'microprocessor', 'arm', 'cortex', 'stm32', 'avr', 'pic', 'ti',
    'arduino', 'raspberry pi', 'esp32', 'esp8266', 'beaglebone', 'nrf', 'nordic',
    
    // Programming languages & tools
    'c/c++', 'assembly language', 'real-time', 'rtos', 'bare metal', 'hal',
    'system programming', 'low level programming', 'cross compilation', 'toolchain',
    
    // Hardware interfaces
    'spi', 'i2c', 'uart', 'can bus', 'ethernet', 'usb', 'gpio', 'pwm', 'adc', 'dac',
    'hardware interface', 'peripheral driver', 'register programming',
    
    // System aspects
    'real-time systems', 'deterministic', 'memory management', 'interrupt handling',
    'power management', 'hardware abstraction', 'board support package', 'bsp',
    
    // Related technologies
    'iot', 'edge computing', 'sensor fusion', 'motor control', 'power electronics',
    'pcb', 'electronics', 'semiconductor', 'asic', 'fpga', 'verilog', 'vhdl',
    
    // Industry applications
    'automotive', 'automotive embedded', 'medical devices', 'industrial control',
    'aerospace', 'telecommunications', 'consumer electronics'
  ];
  
  // Terms that typically indicate irrelevant jobs for embedded systems
  const irrelevantTerms = [
    'web development', 'web developer', 'frontend', 'backend', 'full stack',
    'javascript', 'react', 'angular', 'vue', 'node.js', 'python web', 'django',
    'mobile app', 'ios development', 'android development', 'app store',
    'ui/ux', 'user interface', 'data science', 'machine learning', 'ai',
    'cloud', 'aws', 'azure', 'docker', 'kubernetes', 'devops',
    'website', 'e-commerce', 'wordpress', 'shopify', 'web design',
    'social media', 'marketing technology', 'fintech', 'blockchain'
  ];
  
  const textToAnalyze = (title + ' ' + description + ' ' + company).toLowerCase();
  const titleLower = title.toLowerCase();
  
  let score = 0;
  const matchedKeywords: string[] = [];
  
  // Score positive matches
  for (const keyword of embeddedSystemsKeywords) {
    if (textToAnalyze.includes(keyword)) {
      const keywordScore = 1;
      score += keywordScore;
      matchedKeywords.push(keyword);
      
      // Boost score for title matches (more important)
      if (titleLower.includes(keyword)) {
        score += keywordScore; // Double weight for title matches
        matchedKeywords.push(`${keyword} (title)`);
      }
    }
  }
  
  // Penalty for irrelevant terms
  let irrelevantMatches = 0;
  for (const term of irrelevantTerms) {
    if (textToAnalyze.includes(term)) {
      score -= 2; // Strong penalty for irrelevant terms
      irrelevantMatches++;
    }
  }
  
  // Special case: exact role matching gets high score
  if (titleLower.includes(targetRole.toLowerCase()) || 
      targetRole.toLowerCase().includes('embedded') && textToAnalyze.includes('embedded')) {
    score += 3; // Bonus for role relevance
  }
  
  // Determine filtering reason if score is too low
  let filteredReason: string | undefined;
  if (score < 2) {
    if (irrelevantMatches > 0) {
      filteredReason = 'Contains irrelevant terms (web/mobile/ai development)';
    } else if (matchedKeywords.length === 0) {
      filteredReason = 'No relevant embedded systems keywords found';
    } else {
      filteredReason = 'Low relevance score';
    }
  }
  
  return { score, matchedKeywords, filteredReason };
}

// Test cases with varying relevance scores
const testCases = [
  {
    title: "Embedded Systems Engineer",
    description: "Development of embedded software for ARM Cortex-M microcontrollers using C/C++. Experience with STM32, real-time systems, and hardware interfaces required.",
    company: "TechCorp",
    expectedScore: "High (8-12)"
  },
  {
    title: "Firmware Developer - Automotive",
    description: "Firmware development for automotive embedded systems. Experience with CAN bus, SPI, I2C, and automotive protocols. C programming and RTOS knowledge essential.",
    company: "AutoSystems GmbH",
    expectedScore: "High (8-10)"
  },
  {
    title: "Software Engineer",
    description: "Full-stack web development using React, Node.js, and JavaScript. Building responsive web applications and REST APIs.",
    company: "WebSolutions Inc",
    expectedScore: "Very Low (0-2)"
  },
  {
    title: "Hardware Design Engineer",
    description: "PCB design and analog circuit development for consumer electronics. Experience with EMC, power management, and hardware debugging required.",
    company: "Electronics Pro",
    expectedScore: "Medium (4-6)"
  },
  {
    title: "Data Scientist",
    description: "Machine learning and AI development using Python, TensorFlow, and cloud platforms. Building predictive models and data pipelines.",
    company: "DataTech",
    expectedScore: "Very Low (0-2)"
  },
  {
    title: "IoT Development Engineer",
    description: "Development of IoT devices using ESP32, Raspberry Pi, and embedded Linux. Experience with sensor integration and wireless protocols.",
    company: "IoT Innovations",
    expectedScore: "Medium-High (6-8)"
  }
];

console.log("🧪 Testing Relevance Scoring for Embedded Systems Jobs\n");
console.log("=".repeat(80));

const targetRole = "embedded systems engineer";

testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test Case ${index + 1}: ${testCase.title}`);
  console.log(`Company: ${testCase.company}`);
  console.log(`Description: ${testCase.description.substring(0, 100)}...`);
  console.log(`Expected: ${testCase.expectedScore}`);
  
  const result = calculateRelevanceScore(
    testCase.title,
    testCase.description,
    testCase.company,
    targetRole
  );
  
  console.log(`🎯 Actual Score: ${result.score}`);
  console.log(`📋 Matched Keywords: ${result.matchedKeywords.join(', ') || 'None'}`);
  
  if (result.filteredReason) {
    console.log(`🚫 Filtered Reason: ${result.filteredReason}`);
    console.log(`📊 Action: Would be FILTERED OUT (score < 2)`);
  } else {
    console.log(`✅ Action: Would be KEPT (score >= 2)`);
  }
  
  console.log("-".repeat(80));
});

// Summary statistics
console.log("\n📊 SUMMARY");
console.log("=".repeat(50));

const scores = testCases.map(testCase => 
  calculateRelevanceScore(testCase.title, testCase.description, testCase.company, targetRole).score
);

const keptJobs = scores.filter(score => score >= 2).length;
const filteredJobs = scores.length - keptJobs;

console.log(`Total test cases: ${scores.length}`);
console.log(`Jobs that would be KEPT: ${keptJobs}`);
console.log(`Jobs that would be FILTERED OUT: ${filteredJobs}`);
console.log(`Filter effectiveness: ${((filteredJobs / scores.length) * 100).toFixed(1)}% irrelevant jobs filtered`);

const scoreRange = `Score range: ${Math.min(...scores)} to ${Math.max(...scores)}`;
console.log(`${scoreRange}`);

console.log("\n✅ Relevance scoring test completed!");