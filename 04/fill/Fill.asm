// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed. 
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

// Put your code here.




(LOOP)

  // Load keyboard to D
  @KBD
  D=M

  // Jump to WHITE if D is zero
  @WHITE
  D;JEQ

(BLACK)
  // screen length in words
  @8192
  D=A

  // set R0 to screen length
  @R0
  M=D

(BLACKLOOP)
  @R0
  M=M-1
  D=M

  // load R0 into D
  @R0
  D=M

  // set A to R0 + SCREEN
  @SCREEN
  A=D+A

  // make word black
  M=-1

  @R0
  D=M
  @BLACKLOOP
  D;JNE


  // jump to LOOP
  @LOOP
  0;JMP



(WHITE)
  // screen length in words
  @8192
  D=A

  // set R0 to screen length
  @R0
  M=D

(WHITELOOP)
  @R0
  M=M-1
  D=M

  // load R0 into D
  @R0
  D=M

  // set A to R0 + SCREEN
  @SCREEN
  A=D+A

  // make word white
  M=0

  @R0
  D=M
  @WHITELOOP
  D;JNE

  // jump to LOOP
  @LOOP
  0;JMP
