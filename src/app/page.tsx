"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Zap, AlertTriangle, Plus, X, Users, Mail, Sparkles, Send, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

// Types
type Symptom = { issueId: string; triggerPhrase: string; category: string; machine: string; priority: string; };
type DecisionTree = { issueId: string; q1: string; q2: string; q3: string; };
type TroubleshootingStep = { issueId: string; machine: string; stepNumber: number; instruction: string; ifFixed: string; ifNotFixed: string; };
type EscalationMatrix = { issueId: string; category: string; level1: string; level2: string; level3: string; };

export default function DiagnosticApp() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null);

  // Wizard state
  const [wizardPhase, setWizardPhase] = useState<"QUESTIONS" | "STEPS" | "SUCCESS" | "ESCALATION">("QUESTIONS");
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [currentTree, setCurrentTree] = useState<DecisionTree | null>(null);
  
  // Stepper state
  const [allSteps, setAllSteps] = useState<TroubleshootingStep[]>([]);
  const [activeSteps, setActiveSteps] = useState<TroubleshootingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [escalationData, setEscalationData] = useState<EscalationMatrix | null>(null);
  const [adviceText, setAdviceText] = useState("");

  // Fetch initial data
  useEffect(() => {
    fetch('/api/diagnostic?type=symptoms')
      .then(res => res.json())
      .then(data => {
        const localSymptoms = JSON.parse(localStorage.getItem('customSymptoms') || '[]');
        setSymptoms([...localSymptoms, ...data]);
      })
      .catch(console.error);
  }, []);

  const filteredSymptoms = useMemo(() => {
    return symptoms.filter(sym => {
      const matchCat = selectedCategory === "ALL" || sym.category === selectedCategory;
      const matchSearch = sym.triggerPhrase.toLowerCase().includes(searchQuery.toLowerCase()) || sym.issueId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [symptoms, selectedCategory, searchQuery]);

  const handleSelectSymptom = async (sym: Symptom) => {
    setSelectedSymptom(sym);
    resetWizardState();
    
    // Fetch related data
    try {
      const [treeRes, stepsRes, escRes] = await Promise.all([
        fetch(`/api/diagnostic?type=tree&issueId=${sym.issueId}`),
        fetch(`/api/diagnostic?type=steps&issueId=${sym.issueId}`),
        fetch(`/api/diagnostic?type=escalation&issueId=${sym.issueId}`)
      ]);
      
      let tree = await treeRes.json();
      let steps = await stepsRes.json();
      let esc = await escRes.json();

      if (sym.issueId.startsWith('CUST-')) {
        const localTrees = JSON.parse(localStorage.getItem('customTrees') || '[]');
        tree = localTrees.find((t: DecisionTree) => t.issueId === sym.issueId) || tree;

        const localSteps = JSON.parse(localStorage.getItem('customSteps') || '[]');
        const customSteps = localSteps.filter((s: TroubleshootingStep) => s.issueId === sym.issueId);
        if (customSteps.length > 0) steps = customSteps;

        const localEsc = JSON.parse(localStorage.getItem('customEscalations') || '[]');
        esc = localEsc.find((e: EscalationMatrix) => e.issueId === sym.issueId) || esc;
      }

      setCurrentTree(tree);
      setAllSteps(steps);
      setEscalationData(esc);
    } catch (e) {
      console.error(e);
    }
  };

  const resetWizardState = () => {
    setWizardPhase("QUESTIONS");
    setCurrentQuestionIndex(0);
    setSelectedMachine("");
    setCurrentStepIndex(0);
    setActiveSteps([]);
    setAdviceText("");
  };

  const currentQuestions = useMemo(() => {
    if (!currentTree) return [];
    return [
      { key: 'q1', text: currentTree.q1 },
      { key: 'q2', text: currentTree.q2 },
      { key: 'q3', text: currentTree.q3 }
    ];
  }, [currentTree]);

  const handleAnswerQuestion = (answer: string) => {
    if (currentQuestionIndex === 0) {
      setSelectedMachine(answer);
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      startTroubleshootingStepper();
    }
  };

  const startTroubleshootingStepper = () => {
    let filteredSteps = allSteps.filter(s => 
      s.machine.toLowerCase() === selectedMachine.toLowerCase() || 
      s.machine.toLowerCase() === "all ecw" || 
      s.machine.toLowerCase() === "all machines"
    );

    filteredSteps.sort((a, b) => a.stepNumber - b.stepNumber);

    if (filteredSteps.length === 0) {
      filteredSteps = [...allSteps].sort((a, b) => a.stepNumber - b.stepNumber);
    }

    setActiveSteps(filteredSteps);
    setWizardPhase("STEPS");
    setCurrentStepIndex(0);
    setAdviceText("");
  };

  const handleStepFixed = () => {
    const step = activeSteps[currentStepIndex];
    if (step.ifFixed.toLowerCase().includes("resume production")) {
      setWizardPhase("SUCCESS");
    } else {
      if (currentStepIndex < activeSteps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        setAdviceText("");
      } else {
        setWizardPhase("ESCALATION");
      }
    }
  };

  const handleStepFailed = () => {
    const step = activeSteps[currentStepIndex];
    if (step.ifNotFixed.toLowerCase().includes("escalate")) {
      setWizardPhase("ESCALATION");
    } else {
      setAdviceText(step.ifNotFixed);
    }
  };

  const handleConfirmAction = () => {
    const step = activeSteps[currentStepIndex];
    const actionText = step.ifNotFixed.toLowerCase();
    
    setAdviceText("");

    if (actionText.includes("go back to step") || actionText.includes("repeat")) {
        const stepNumMatch = actionText.match(/\d+/);
        if (stepNumMatch) {
            const targetStepNum = parseInt(stepNumMatch[0]);
            const targetIdx = activeSteps.findIndex(s => s.stepNumber === targetStepNum);
            if (targetIdx !== -1) {
                setAdviceText(`Returning to Step ${targetStepNum} to verify: "${activeSteps[targetIdx].instruction}"`);
                setTimeout(() => {
                  setCurrentStepIndex(targetIdx);
                  setAdviceText("");
                }, 2000);
                return;
            }
        }
    }
    
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setWizardPhase("ESCALATION");
    }
  };

  const handleAddIssue = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newIssue: Symptom = {
      issueId: `CUST-${Date.now().toString().slice(-4)}`,
      triggerPhrase: formData.get('triggerPhrase') as string,
      category: formData.get('category') as string,
      machine: formData.get('machine') as string,
      priority: formData.get('priority') as string,
    };

    const newSymptoms = [newIssue, ...symptoms];
    setSymptoms(newSymptoms);
    
    const localSymptoms = JSON.parse(localStorage.getItem('customSymptoms') || '[]');
    localStorage.setItem('customSymptoms', JSON.stringify([newIssue, ...localSymptoms]));

    const dummyTree: DecisionTree = {
      issueId: newIssue.issueId,
      q1: "What machine?",
      q2: "When did this start?",
      q3: "Have you rebooted?"
    };
    
    const dummySteps: TroubleshootingStep[] = [
      {
        issueId: newIssue.issueId,
        machine: newIssue.machine,
        stepNumber: 1,
        instruction: "Investigate the reported issue visually.",
        ifFixed: "Resume production",
        ifNotFixed: "Escalate"
      }
    ];

    const dummyEscalation: EscalationMatrix = {
      issueId: newIssue.issueId,
      category: newIssue.category,
      level1: "Lead Technician",
      level2: "Engineering",
      level3: "Engineering Manager"
    };

    const localTrees = JSON.parse(localStorage.getItem('customTrees') || '[]');
    localStorage.setItem('customTrees', JSON.stringify([...localTrees, dummyTree]));

    const localSteps = JSON.parse(localStorage.getItem('customSteps') || '[]');
    localStorage.setItem('customSteps', JSON.stringify([...localSteps, ...dummySteps]));

    const localEsc = JSON.parse(localStorage.getItem('customEscalations') || '[]');
    localStorage.setItem('customEscalations', JSON.stringify([...localEsc, dummyEscalation]));

    setShowAddIssue(false);
  };

  const handleAskAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiResponse("");
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      if (data.error) {
        setAiResponse(`Error: ${data.error}`);
      } else {
        setAiResponse(data.text);
      }
    } catch (e: any) {
      setAiResponse(`Failed to connect to AI assistant. ${e.message}`);
    } finally {
      setIsAiLoading(false);
      setAiPrompt("");
    }
  };

  const mobileBackToList = () => {
    setSelectedSymptom(null);
  };

  return (
    <>
      <header className="px-6 py-4 border-b border-white/5 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <h1 className="font-orbitron text-xl tracking-wider bg-gradient-to-br from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Eng-Troubleshooting Guide(ETG)
          </h1>
          <div className="bg-bluePrimary/20 border border-bluePrimary text-bluePrimary px-2 py-0.5 rounded text-[0.65rem] font-bold font-orbitron uppercase hidden sm:block">
            SAFETY FIRST!
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAiAssistant(true)}
            className="flex items-center gap-2 bg-bluePrimary/20 hover:bg-bluePrimary/30 text-bluePrimary px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-bluePrimary/30"
          >
            <Sparkles size={16} />
            <span className="hidden sm:inline">Smart Assistant</span>
          </button>
          <button 
            onClick={() => setShowContacts(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border border-white/10"
          >
            <Users size={16} />
            <span className="hidden sm:inline">Contacts</span>
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[350px_1fr] h-[calc(100vh-65px)]">
        
        {/* Sidebar */}
        <div className={`border-r border-white/5 bg-[#0a0f1a]/40 flex flex-col p-5 gap-4 overflow-y-auto ${selectedSymptom ? 'hidden md:flex' : 'flex'}`}>
          <div className="font-orbitron text-xs uppercase tracking-wider text-textSecondary">Symptom Search</div>
          <div className="relative">
            <input 
              type="text" 
              className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#090d16]/80 text-white text-sm outline-none focus:border-bluePrimary focus:shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all"
              placeholder="Search trigger phrases..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="font-orbitron text-xs uppercase tracking-wider text-textSecondary mt-2">Categories</div>
          <div className="flex gap-2 overflow-x-auto pb-2 whitespace-nowrap category-tabs">
            {["ALL", "Vision", "Spray Quality", "Dispense", "Software", "Material", "Hardware"].map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
                  selectedCategory === cat 
                    ? 'bg-bluePrimary/20 border-bluePrimary text-white' 
                    : 'bg-white/5 border-white/10 text-textSecondary hover:bg-white/10'
                }`}
              >
                {cat === 'Spray Quality' ? 'Spray' : cat}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mt-2">
            <div className="font-orbitron text-xs uppercase tracking-wider text-textSecondary">Symptom List</div>
            <button onClick={() => setShowAddIssue(true)} className="text-xs bg-bluePrimary/20 text-bluePrimary px-2 py-1 rounded hover:bg-bluePrimary/30 transition-colors flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1">
            {filteredSymptoms.map(sym => {
              let priorityColor = "border-amber-500 text-amber-500 bg-amber-500/20";
              if (sym.priority === "High") priorityColor = "border-red-500 text-red-500 bg-red-500/20";
              if (sym.priority === "Critical") priorityColor = "border-red-600 text-red-500 bg-red-700/30";

              return (
                <div 
                  key={sym.issueId}
                  onClick={() => handleSelectSymptom(sym)}
                  className={`bg-bgCard border rounded-lg p-3 cursor-pointer transition-all relative overflow-hidden group ${
                    selectedSymptom?.issueId === sym.issueId 
                      ? 'border-bluePrimary bg-bluePrimary/10' 
                      : 'border-white/5 hover:border-bluePrimary hover:-translate-y-[1px]'
                  }`}
                >
                  {selectedSymptom?.issueId === sym.issueId && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-bluePrimary" />
                  )}
                  <div className="font-orbitron text-[0.7rem] font-bold text-bluePrimary mb-1">{sym.issueId}</div>
                  <div className="text-sm font-semibold mb-2">{sym.triggerPhrase}</div>
                  <div className="flex justify-between items-center text-[0.7rem] text-textSecondary">
                    <span>{sym.machine}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${priorityColor}`}>
                      {sym.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workspace */}
        <div className={`p-4 md:p-6 overflow-y-auto flex-col items-center justify-start ${!selectedSymptom ? 'hidden md:flex' : 'flex'}`}>
          {selectedSymptom && (
            <button 
              onClick={mobileBackToList}
              className="md:hidden self-start mb-4 bg-white/5 border border-white/10 text-textPrimary px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Back to Symptoms List
            </button>
          )}

          {!selectedSymptom ? (
            <div className="text-center max-w-lg mt-24">
              <h2 className="font-orbitron text-2xl mb-2 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">Diagnostic Workspace</h2>
              <p className="text-textSecondary text-sm">Select a symptom from the sidebar list to initialize the automated troubleshooting wizard.</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl flex flex-col gap-4">
              <div className="flex flex-col border-b border-white/5 pb-3">
                <h3 className="text-xl font-bold mb-1">{selectedSymptom.triggerPhrase}</h3>
                <p className="text-textSecondary text-xs">
                  Issue ID: {selectedSymptom.issueId} | Category: {selectedSymptom.category} | Priority: {selectedSymptom.priority}
                </p>
              </div>

              <div className="bg-bgCard border border-borderGlow shadow-2xl rounded-xl p-5 md:p-6 backdrop-blur-md relative">
                
                {/* Phase: Questions */}
                {wizardPhase === "QUESTIONS" && currentTree && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="font-orbitron text-xs text-bluePrimary mb-3 tracking-wider uppercase">
                      Question {currentQuestionIndex + 1} of 3
                    </div>
                    <div className="text-lg font-semibold mb-5 leading-relaxed">
                      {currentQuestions[currentQuestionIndex].text}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestions[currentQuestionIndex].text.toLowerCase().includes("machine") || 
                       currentQuestions[currentQuestionIndex].text.toLowerCase().includes("sc350 or sc450") ? (
                        Array.from(new Set(allSteps.map(s => s.machine))).map(mach => (
                          <button 
                            key={mach}
                            onClick={() => handleAnswerQuestion(mach)}
                            className="bg-white/5 border border-white/10 rounded-lg p-4 text-left text-sm font-medium hover:bg-bluePrimary/10 hover:border-bluePrimary transition-all flex justify-between items-center group"
                          >
                            <span>{mach}</span>
                            <span className="text-bluePrimary font-bold group-hover:translate-x-1 transition-transform">→</span>
                          </button>
                        ))
                      ) : (
                        ["Yes / Verified", "No / Failed"].map(opt => (
                          <button 
                            key={opt}
                            onClick={() => handleAnswerQuestion(opt)}
                            className="bg-white/5 border border-white/10 rounded-lg p-4 text-left text-sm font-medium hover:bg-bluePrimary/10 hover:border-bluePrimary transition-all flex justify-between items-center group"
                          >
                            <span>{opt}</span>
                            <span className="text-bluePrimary font-bold group-hover:translate-x-1 transition-transform">→</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Phase: Steps */}
                {wizardPhase === "STEPS" && activeSteps.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-4">
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2 border-b border-white/5 step-timeline">
                      {activeSteps.map((step, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            if (idx <= currentStepIndex) {
                              setCurrentStepIndex(idx);
                              setAdviceText("");
                            }
                          }}
                          className={`px-3 py-1 rounded text-[0.7rem] font-orbitron font-bold whitespace-nowrap transition-all border ${
                            idx === currentStepIndex 
                              ? 'bg-bluePrimary/20 border-bluePrimary text-white' 
                              : idx < currentStepIndex 
                                ? 'bg-greenPrimary/15 border-greenPrimary/50 text-greenPrimary cursor-pointer hover:bg-greenPrimary/25' 
                                : 'bg-white/5 border-white/10 text-textSecondary cursor-not-allowed opacity-50'
                          }`}
                        >
                          Step {step.stepNumber}
                        </button>
                      ))}
                    </div>

                    <div className="font-orbitron text-xs text-bluePrimary mb-1 tracking-wider uppercase">
                      Troubleshooting Step {currentStepIndex + 1} of {activeSteps.length}
                    </div>
                    <div className="text-base md:text-lg font-medium leading-relaxed bg-white/5 p-4 rounded-lg border-l-4 border-bluePrimary mb-2">
                      {activeSteps[currentStepIndex].instruction}
                    </div>

                    {!adviceText ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <button 
                          onClick={handleStepFixed}
                          className="bg-greenPrimary text-white p-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-greenPrimary/90 transition-colors"
                        >
                          ✓ Issue Resolved
                        </button>
                        <button 
                          onClick={handleStepFailed}
                          className="bg-redPrimary text-white p-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-redPrimary/90 transition-colors"
                        >
                          ✗ Not Resolved
                        </button>
                      </div>
                    ) : (
                      <div className="bg-red-500/10 border border-dashed border-red-500/30 rounded-lg p-4 mt-2 text-red-300 text-sm leading-relaxed animate-in fade-in zoom-in-95 duration-200">
                        <strong>Action Required:</strong> {adviceText}
                        <button 
                          onClick={handleConfirmAction}
                          className="bg-red-500/20 border border-red-500 text-white p-2.5 rounded-md font-semibold text-xs mt-3 w-full text-center hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                        >
                          <Zap size={14} /> Confirm Action Completed
                        </button>
                      </div>
                    )}

                    {currentStepIndex > 0 && (
                      <button 
                        onClick={() => {
                          setCurrentStepIndex(prev => prev - 1);
                          setAdviceText("");
                        }}
                        className="bg-transparent border border-white/10 text-textSecondary px-3 py-2 rounded-md cursor-pointer font-medium inline-flex items-center gap-2 text-xs self-start mt-2 hover:bg-white/5 transition-colors"
                      >
                        <ArrowLeft size={14} /> Go Back (Previous Step)
                      </button>
                    )}
                  </div>
                )}

                {/* Phase: Success */}
                {wizardPhase === "SUCCESS" && (
                  <div className="flex flex-col items-center gap-4 py-6 text-center animate-in zoom-in-95 duration-300">
                    <div className="w-14 h-14 rounded-full bg-greenPrimary/20 text-greenPrimary flex items-center justify-center border-2 border-greenPrimary">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold">Troubleshooting Successful!</h3>
                    <p className="text-textSecondary text-sm max-w-sm">The issue has been resolved. You can safely resume standard production.</p>
                    <button 
                      onClick={() => setSelectedSymptom(null)}
                      className="mt-4 px-6 py-2.5 bg-bluePrimary text-white rounded-md font-bold text-sm hover:bg-blueHover transition-colors"
                    >
                      Diagnose Another Issue
                    </button>
                  </div>
                )}

                {/* Phase: Escalation */}
                {wizardPhase === "ESCALATION" && (
                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="text-redPrimary text-xl font-bold flex items-center gap-2">
                      <AlertTriangle size={24} /> Escalation Triggered!
                    </div>
                    <p className="text-sm text-textSecondary mb-2">
                      All troubleshooting steps failed to resolve the issue. Please initiate standard escalation protocol immediately:
                    </p>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      {[
                        { level: "Level 1 Contact", role: escalationData?.level1 || "Lead Technician" },
                        { level: "Level 2 Contact", role: escalationData?.level2 || "ESC Support" },
                        { level: "Level 3 Contact", role: escalationData?.level3 || "Engineering Manager" }
                      ].map((esc, i) => (
                        <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                          <div className="font-orbitron text-[0.65rem] text-textSecondary uppercase tracking-wider">{esc.level}</div>
                          <div className="text-sm font-bold text-white">{esc.role}</div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setSelectedSymptom(null)}
                      className="mt-4 px-6 py-2.5 bg-bluePrimary text-white rounded-md font-bold text-sm hover:bg-blueHover transition-colors self-start"
                    >
                      Back to Home
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </main>

      {showAddIssue && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bgCard border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAddIssue(false)}
              className="absolute top-4 right-4 text-textSecondary hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="font-orbitron text-xl mb-1 text-white">Add New Issue</h2>
            <p className="text-textSecondary text-xs mb-6">Create a new diagnostic procedure.</p>
            
            <form onSubmit={handleAddIssue} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-orbitron uppercase text-textSecondary mb-1.5">Trigger Phrase (Symptom)</label>
                <input required name="triggerPhrase" type="text" placeholder="e.g. Conveyor Belt Stopped" className="w-full bg-[#090d16] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-bluePrimary focus:shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all" />
              </div>
              
              <div>
                <label className="block text-xs font-orbitron uppercase text-textSecondary mb-1.5">Category</label>
                <select required name="category" className="w-full bg-[#090d16] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-bluePrimary transition-all appearance-none">
                  <option value="Vision">Vision</option>
                  <option value="Spray Quality">Spray Quality</option>
                  <option value="Dispense">Dispense</option>
                  <option value="Software">Software</option>
                  <option value="Material">Material</option>
                  <option value="Hardware">Hardware</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-orbitron uppercase text-textSecondary mb-1.5">Machine Type</label>
                  <input required name="machine" type="text" placeholder="e.g. All Machines" className="w-full bg-[#090d16] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-bluePrimary transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-orbitron uppercase text-textSecondary mb-1.5">Priority</label>
                  <select required name="priority" className="w-full bg-[#090d16] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-bluePrimary transition-all appearance-none">
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-bluePrimary text-white rounded-lg py-3 font-semibold text-sm hover:bg-blueHover transition-colors">
                  Save Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContacts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bgCard border border-white/10 rounded-xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-white/5 shrink-0 relative">
              <button 
                onClick={() => setShowContacts(false)}
                className="absolute top-6 right-6 text-textSecondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <h2 className="font-orbitron text-xl mb-1 text-white flex items-center gap-2">
                <Users size={20} className="text-bluePrimary" /> Escalation Contacts
              </h2>
              <p className="text-textSecondary text-xs">Directory of on-call support and engineering.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-3">
              {[
                { name: "John Doe", role: "Lead Technician", email: "jdoe@example.com" },
                { name: "Jane Smith", role: "SE Engineer", email: "jsmith@example.com" },
                { name: "Bob Johnson", role: "ESC Support", email: "bjohnson@example.com" },
                { name: "Alice Williams", role: "Engineering Manager", email: "awilliams@example.com" },
                { name: "Maintenance Team", role: "Maintenance", email: "maintenance@example.com" },
              ].map((contact, i) => (
                <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white mb-0.5">{contact.name}</div>
                    <div className="font-orbitron text-[0.65rem] text-bluePrimary uppercase tracking-wider">{contact.role}</div>
                  </div>
                  <a 
                    href={`mailto:${contact.email}`}
                    className="bg-bluePrimary/10 text-bluePrimary hover:bg-bluePrimary hover:text-white border border-bluePrimary/30 rounded-md px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto"
                  >
                    <Mail size={14} /> Email
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showAiAssistant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-bgCard border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/5 shrink-0 relative bg-gradient-to-r from-bluePrimary/10 to-transparent rounded-t-xl">
              <button 
                onClick={() => setShowAiAssistant(false)}
                className="absolute top-6 right-6 text-textSecondary hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <h2 className="font-orbitron text-xl mb-1 text-white flex items-center gap-2">
                <Sparkles size={20} className="text-bluePrimary" /> ETG Smart Assistant
              </h2>
              <p className="text-textSecondary text-xs">Describe the issue and our AI will provide step-by-step diagnostic guidance.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {aiResponse ? (
                <div className="bg-black/30 border border-white/5 rounded-lg p-5">
                  <div className="prose prose-invert prose-sm max-w-none text-white/90">
                    <Markdown>{aiResponse}</Markdown>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-textSecondary/50 text-sm">
                  Ask a question below to get started...
                </div>
              )}
              {isAiLoading && (
                <div className="flex items-center gap-2 text-bluePrimary text-sm font-medium">
                  <Loader2 size={16} className="animate-spin" /> Analyzing diagnostic procedures...
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 shrink-0 bg-black/20 rounded-b-xl">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleAskAi(); }}
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isAiLoading}
                  placeholder="E.g. Machine SC350 has a tank A alarm, but the scale reads normal..."
                  className="flex-1 bg-[#090d16] border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-bluePrimary transition-all disabled:opacity-50"
                />
                <button 
                  type="submit"
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="bg-bluePrimary text-white rounded-lg px-5 py-3 font-semibold hover:bg-blueHover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
