import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const STORAGE_KEY = (puzzleNumber: number) => `noncedle-puzzle-${puzzleNumber}`;
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;

const LEADING_ZEROES = 4;
const startDate = new Date('2024-11-29');

type Attempt = boolean[];

const calculateHash = async (input: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const xoshiro128ss = (a: number, b: number, c: number, d: number) => {
  return function() {
    const t = b << 9;
    let r = a * 5;
    r = (r << 7 | r >>> 25) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = d << 11 | d >>> 21;
    return r >>> 0;
  };
};

// Replace generateMockBlockHeader with this version
const generateMockBlockHeader = (puzzleNumber: number): string => {
  // Use puzzle number as seed
  const rng = xoshiro128ss(puzzleNumber, puzzleNumber * 747, puzzleNumber * 911, puzzleNumber * 537);
  
  // Generate a random merkle root that's consistent for this puzzle number
  const merkleHex = Array.from({length: 32}, () => 
    rng().toString(16).padStart(8, '0').slice(0, 2)
  ).join('');

  // Use actual timestamp for the day rather than current time
  const timestamp = startDate.getTime() + (puzzleNumber - 1) * 24 * 60 * 60 * 1000;

  return `version=2;prev=00000000000000000${puzzleNumber - 1};height=${puzzleNumber};timestamp=${timestamp};merkle=${merkleHex}`;
};

const NoncedleGame: React.FC = () => {
  const [blockHeader, setBlockHeader] = useState<string>('');
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [latestHash, setLatestHash] = useState<string>('');
  const [latestNonce, setLatestNonce] = useState<number | null>(null);
  const [won, setWon] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [autoGuessing, setAutoGuessing] = useState<boolean>(false);
  const [totalGuesses, setTotalGuesses] = useState<number>(0);


  useEffect(() => {
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const todaysPuzzleNumber = daysSinceStart + 1;
    setPuzzleNumber(todaysPuzzleNumber);
    setBlockHeader(generateMockBlockHeader(todaysPuzzleNumber));
}, []);

  const checkHash = useCallback((hash: string): boolean[] => {
    const leadingDigits = hash.substring(0, LEADING_ZEROES);
    return leadingDigits.split('').map(digit => digit === '0');
  }, []);

  const handleGuess = async (nonce: number): Promise<boolean> => {
    try {
      if (isNaN(nonce) || nonce < 0) {
        setError('Please enter a valid positive integer');
        return false;
      }

      const combinedInput = blockHeader + nonce;
      const newHash = await calculateHash(combinedInput);
      setLatestHash(newHash);
      setLatestNonce(nonce);
      
      const result = checkHash(newHash);
      setAttempts(prev => {
             const newAttempts = [...prev, result];
             if (newAttempts.length > 1000) {
               return newAttempts.slice(-1000);
             }
             return newAttempts;
           });
      setTotalGuesses(prev => prev + 1);
      
      if (result.every(x => x)) {
        setWon(true);
        return true;
      }
      return false;
    } catch (err) {
      setError('An error occurred while processing your guess');
      return false;
    }
  };

  const handleManualGuess = async (): Promise<boolean> => {
    const success = await handleGuess(parseInt(currentGuess));
    setCurrentGuess('');
    return success;
  };

const startAutoGuessing = () => setAutoGuessing(true);
const stopAutoGuessing = () => setAutoGuessing(false);

useEffect(() => {
   let timeoutId: number;
   
   const makeGuess = async () => {
     if (!autoGuessing || won) return;
     
     const randomNonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
     const success = await handleGuess(randomNonce);
     
     if (success) {
       stopAutoGuessing();
     } else if (autoGuessing) {
       timeoutId = window.setTimeout(makeGuess, 0.1);
     }
   };
   
   if (autoGuessing) {
     void makeGuess();
   }
   
   return () => {
     if (timeoutId) {
       window.clearTimeout(timeoutId);
     }
   };
 }, [autoGuessing, won]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const newProgress = [...konamiProgress];
      if (event.key === KONAMI_CODE[konamiProgress.length]) {
        newProgress.push(event.key);
        setKonamiProgress(newProgress);
        
        if (newProgress.length === KONAMI_CODE.length) {
          setKonamiProgress([]);
          startAutoGuessing();
        }
      } else {
        setKonamiProgress([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiProgress]);

  useEffect(() => {
    const loadSavedState = () => {
      const saved = localStorage.getItem(STORAGE_KEY(puzzleNumber));
      if (saved) {
        const state = JSON.parse(saved);
        setAttempts(state.attempts);
        setTotalGuesses(state.totalGuesses);
        setWon(state.won);
        setLatestHash(state.latestHash);
        setLatestNonce(state.latestNonce);
      }
    };
    loadSavedState();
  }, [puzzleNumber]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(puzzleNumber), JSON.stringify({
      attempts,
      totalGuesses,
      won,
      latestHash,
      latestNonce
    }));
  }, [attempts, totalGuesses, won, latestHash, latestNonce, puzzleNumber]);

  return (
    <div className="w-screen h-screen items-center justify-center bg-gray-100">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-widest" style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
          NONCEDLE
        </h1>
        <div className="text-sm">
          #{puzzleNumber}
        </div>
        <div className="text-sm text-gray-600">
          Guess an integer that gives the block hash {LEADING_ZEROES} leading zeroes!
        </div>
      </div>
      <div className="px-4">
        <div className="space-y-4">
          <div className="text-sm font-mono break-all bg-gray-200 p-3 rounded-lg">
            {blockHeader}
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <div className="flex space-x-2">
              <Input
                type="number"
                value={currentGuess}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentGuess(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && currentGuess && !won && !autoGuessing) {
                  void handleManualGuess();
                  }
                  }}
                placeholder="Enter nonce..."
                className="flex-1"
                disabled={won || autoGuessing}
              />
              <Button 
                onClick={() => void handleManualGuess()}
                disabled={won || !currentGuess || autoGuessing}
              >
                Guess
              </Button>
            </div>
            {won && (
            <Alert className="bg-green-100">
              <AlertDescription>
              🎉 Congratulations! You found a valid hash in {totalGuesses} guesses! 🎉
              </AlertDescription>
            </Alert>
          )}
           {totalGuesses > 0 && (<div className="text-center text-sm text-gray-600">
              Guesses: {totalGuesses} / 50,000
            </div>
           )}
            {autoGuessing && !won && (
            <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded">
              <button
                onClick={stopAutoGuessing}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
              <div className="flex-1 text-sm text-gray-600">
              ⛏️Mining...⛏️
              </div>
            </div>
          )}
            {latestNonce && (
              <div className="text-sm font-mono break-all text-gray-600">
                Last nonce: {latestNonce}
              </div>
            )}
            {latestHash && (
              <div className="text-sm font-mono break-all text-gray-600">
                Last hash: {latestHash}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-0.5 gap-y-2">
            {attempts.map((attempt, attemptIndex) => (
              <div key={attemptIndex} className="flex flex-col gap-0.3">
                {attempt.map((isZero, digitIndex) => (
                  <div
                    key={digitIndex}
                    className={`w-1.5 h-1.5
                      ${isZero ? 'bg-green-500' : 'bg-red-500'} 
                      border border-gray-300`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoncedleGame;