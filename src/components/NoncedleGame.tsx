import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;

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
  const [autoGuessInterval, setAutoGuessInterval] = useState<number | null>(null);
  const [totalGuesses, setTotalGuesses] = useState<number>(0);

  useEffect(() => {
    const startDate = new Date('2024-01-01');
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const todaysPuzzleNumber = daysSinceStart + 1;
    setPuzzleNumber(todaysPuzzleNumber);
    setBlockHeader(generateMockBlockHeader(todaysPuzzleNumber));

    return () => {
      if (autoGuessInterval) {
        window.clearInterval(autoGuessInterval);
      }
    };
  }, []);

  const checkHash = useCallback((hash: string): boolean[] => {
    const leadingDigits = hash.substring(0, 3);
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

  const startAutoGuessing = (): void => {
    if (autoGuessInterval) return;
    
    const makeGuess = async () => {
      const randomNonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      const success = await handleGuess(randomNonce);
      if (success) {
        stopAutoGuessing();
      }
    };

    makeGuess();
    const interval = window.setInterval(makeGuess, 1);
    
    setAutoGuessInterval(interval);
    setAutoGuessing(true);
  };

  const stopAutoGuessing = (): void => {
    if (autoGuessInterval) {
      window.clearInterval(autoGuessInterval);
      setAutoGuessInterval(null);
    }
    setAutoGuessing(false);
  };

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
          Guess the integer that gives the block hash three leading zeroes!
        </div>
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

          {won && (
            <Alert className="bg-green-100">
              <AlertDescription>
                Congratulations! You found a nonce that produces 3 leading zeros! 🎉
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>

      <AlertDialog open={autoGuessing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Generating random guesses...
              <div className="text-sm font-normal text-gray-500">
                Attempts: {totalGuesses}
              </div>
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={stopAutoGuessing}>Stop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default NoncedleGame;