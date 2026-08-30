#pragma once

#include <windows.h>
#include <string>
#include <vector>
#include "../mapi_types.h"  // For LHANDLE and other MAPI types

namespace mapi_test {

// Test utilities for loading and testing the SendArc interceptor DLL.

// Function pointer type for MAPISendMail
#ifdef _MSC_VER
using MAPISendMailFunc = LPMAPISENDMAIL;
#else
typedef ULONG (WINAPI *MAPISendMailFunc)(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    void* lpMessage,
    ULONG flFlags,
    ULONG ulReserved
);
#endif

class TestUtilities {
public:
    // Configure and load the exact interceptor DLL passed to the harness.
    static void SetInterceptorDllPath(const std::wstring& dllPath);
    static HMODULE LoadInterceptorDll();

    // Load an interceptor DLL and get the MAPISendMail function pointer.
    static MAPISendMailFunc LoadMAPISendMail(const std::string& dllPath);

    // Verify a JSON file was created by this harness in the queue directory.
    static bool VerifyJsonFileCreated(const std::string& queueDir);

    // Parse and validate a JSON file
    static bool ValidateJsonFile(const std::string& filePath);

    // Clean up test files
    static void CleanupTestFiles(const std::string& queueDir);

    // Get the queue directory used by the interceptor DLL.
    static std::string GetSendArcQueueDir();

    // Print test result
    static void PrintTestResult(const std::string& testName, bool passed);

    // Get count of JSON files in directory
    static int GetJsonFileCount(const std::string& queueDir);

    // Return the newest JSON file produced by this harness, or an empty string.
    static std::string GetNewestJsonPath(const std::string& queueDir);

    // Read the content of the newest JSON file in the directory
    static std::string ReadNewestJsonContent(const std::string& queueDir);
};

}  // namespace mapi_test
