import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;

const LEADING_ZEROES = 2;
type Attempt = boolean[];

const calculateHash = async (input: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const generateMockBlockHeader = (puzzleNumber: number): string => {
  const timestamp = Date.now();
  return `version=2;prev=00000000000000000${puzzleNumber - 1};height=${puzzleNumber};timestamp=${timestamp};merkle=4d6172696f2069732077617463`;
};

const NoncedleGame: React.FC = () => {
  const [blockHeader, setBlockHeader] = useState<string>('');
  const [puzzleNumber, setPuzzleNumber] = useState<number>(1);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [latestHash, setLatestHash] = useState<string>('');
  const [won, setWon] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [autoGuessing, setAutoGuessing] = useState<boolean>(false);
  const [totalGuesses, setTotalGuesses] = useState<number>(0);
  const [successfulNonce, setSuccessfulNonce] = useState<number | null>(null);


  useEffect(() => {
    const startDate = new Date('2024-11-28');
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
        setSuccessfulNonce(nonce);
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
       timeoutId = window.setTimeout(makeGuess, 1);
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

  return (
    <Card className="w-full flex flex-col">
      <CardHeader className="text-center space-y-4">
        <CardTitle className="text-4xl font-bold tracking-widest" style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
          NONCEDLE
        </CardTitle>
        <div className="text-sm">
          #{puzzleNumber}
        </div>
        <div className="text-sm text-gray-600">
          Guess the integer that gives the block hash {LEADING_ZEROES} leading zeroes!
        </div>
        {won && (
            <Alert className="bg-green-100">
              <AlertDescription>
                Congratulations! You found a nonce {successfulNonce} that produces {LEADING_ZEROES} leading zeros! 🎉
              </AlertDescription>
            </Alert>
          )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm font-mono break-all bg-gray-100 p-3 rounded-lg">
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
            
            <div className="text-center text-sm text-gray-600">
              Guesses: {totalGuesses} / 1,000,000
            </div>
            {autoGuessing && !won && (
            <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded">
              <button
                onClick={stopAutoGuessing}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
              <div className="flex-1 text-sm text-gray-600">
                Mining...
              </div>
            </div>
          )}
            
            {latestHash && (
              <div className="text-sm font-mono break-all text-gray-600">
                Latest hash: {latestHash}
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
      </CardContent>
    </Card>
  );
};

export default NoncedleGame;