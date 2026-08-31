; x64 Simple MAPI export landing pads with canonical Windows XFG hashes.
;
; Current Windows mapi32.dll places the prototype hash in R10 and compares it
; with the eight bytes immediately before the provider address returned by
; GetProcAddress. These values are the stable hashes for the corresponding
; Windows SDK Simple MAPI prototypes. Bit zero is set on a function-side hash.

OPTION CASEMAP:NONE

EXTERN SendArc_MAPISendMail_Impl:PROC
EXTERN SendArc_MAPISendMailW_Impl:PROC
EXTERN SendArc_MAPILogon_Impl:PROC
EXTERN SendArc_MAPILogoff_Impl:PROC
EXTERN SendArc_MAPIFreeBuffer_Impl:PROC
EXTERN SendArc_MAPISendDocuments_Impl:PROC

.code

ALIGN 8
DQ 0A255A7A23CD2DB71h
MAPISendMail PROC
    jmp SendArc_MAPISendMail_Impl
MAPISendMail ENDP

ALIGN 8
DQ 0D8D0BEE67A5D3271h
MAPISendMailW PROC
    jmp SendArc_MAPISendMailW_Impl
MAPISendMailW ENDP

ALIGN 8
DQ 0E755B7C63ED19871h
MAPILogon PROC
    jmp SendArc_MAPILogon_Impl
MAPILogon ENDP

ALIGN 8
DQ 081F0A751725AF871h
MAPILogoff PROC
    jmp SendArc_MAPILogoff_Impl
MAPILogoff ENDP

ALIGN 8
DQ 0B099976A12DCA271h
MAPIFreeBuffer PROC
    jmp SendArc_MAPIFreeBuffer_Impl
MAPIFreeBuffer ENDP

ALIGN 8
DQ 0A738177716D2C171h
MAPISendDocuments PROC
    jmp SendArc_MAPISendDocuments_Impl
MAPISendDocuments ENDP

END
