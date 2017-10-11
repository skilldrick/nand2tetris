// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Mult.asm

// Multiplies R0 and R1 and stores the result in R2.
// (R0, R1, R2 refer to RAM[0], RAM[1], and RAM[2], respectively.)

  // initialize R2
  @R2
  M=0


(LOOP)
  // check R0 is not zero
  @R0
  D=M
  @END
  D;JEQ

  // check R1 is not zero
  @R1
  D=M
  @END
  D;JEQ

  // D is now R1. Add D to R2
  @R2
  M=D+M

  // decrement R0
  @R0
  M=M-1

  // load R0 into D
  D=M

  // jump back up
  @LOOP
  D;JMP

(END)
  @END
  0;JMP
