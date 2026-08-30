#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include "../test_utils.h"

// Forward declarations of test functions
extern int test_simple_send();
extern int test_with_attachments();
extern int test_unicode();
extern int test_multiple_recipients();
extern int test_unicode_wide();
extern int test_ansi_encoding();
extern int test_null_filename();
extern int emit_e2e_message();

using namespace mapi_test;

int main(int argc, char* argv[]) {
    std::cout << "=================================" << std::endl;
    std::cout << "  SendArc MAPI Test Harness" << std::endl;
    std::cout << "=================================" << std::endl;
    std::cout << std::endl;

    // `--emit-e2e <dll>` performs one real wide Simple MAPI call directly
    // through a test interceptor. `--emit-system-mapi` sends the same message
    // through Windows' MAPI32 stub so installer acceptance can prove that the
    // registered default handler routes into the installed SendArc DLL.
    bool emitE2E = argc == 3 && std::string(argv[1]) == "--emit-e2e";
    bool emitSystemMapi = argc == 2 && std::string(argv[1]) == "--emit-system-mapi";

    // Determine DLL path
    std::string dllPath = "SendArc.dll";
    if (emitE2E) {
        dllPath = argv[2];
    } else if (emitSystemMapi) {
        wchar_t systemDirectory[MAX_PATH] = {};
        UINT length = GetSystemDirectoryW(systemDirectory, MAX_PATH);
        if (length == 0 || length >= MAX_PATH) {
            std::cerr << "Failed to resolve the Windows system directory" << std::endl;
            return 1;
        }
        dllPath = (std::filesystem::path(systemDirectory) / L"mapi32.dll").string();
    } else if (argc > 1) {
        dllPath = argv[1];
    }

    std::filesystem::path absoluteDllPath = std::filesystem::absolute(dllPath);
    if (!std::filesystem::is_regular_file(absoluteDllPath)) {
        std::cerr << "DLL not found: " << absoluteDllPath.string() << std::endl;
        return 1;
    }

    TestUtilities::SetInterceptorDllPath(absoluteDllPath.wstring());

    if (emitE2E || emitSystemMapi) {
        return emit_e2e_message();
    }

    std::cout << "Using DLL: " << absoluteDllPath.string() << std::endl;
    std::cout << std::endl;

    // Get the interceptor queue directory.
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    if (tempDir.empty()) {
        std::cerr << "Failed to get interceptor queue directory" << std::endl;
        return 1;
    }

    std::cout << "Monitoring: " << tempDir << std::endl;
    std::cout << std::endl;

    // Run tests
    int testsPassed = 0;
    int testsFailed = 0;

    std::vector<std::pair<std::string, int(*)()>> tests = {
        { "Simple Send", test_simple_send },
        { "With Attachments", test_with_attachments },
        { "Unicode (ANSI)", test_unicode },
        { "Unicode (Wide/MAPISendMailW)", test_unicode_wide },
        { "Multiple Recipients", test_multiple_recipients },
        { "ANSI Codepage Encoding", test_ansi_encoding },
        { "Null Filename (path fallback)", test_null_filename },
    };

    for (const auto& test : tests) {
        TestUtilities::CleanupTestFiles(tempDir);
        int result = test.second();
        if (result == 0) {
            testsPassed++;
            TestUtilities::PrintTestResult(test.first, true);
        } else {
            testsFailed++;
            TestUtilities::PrintTestResult(test.first, false);
        }
        TestUtilities::CleanupTestFiles(tempDir);
    }

    std::cout << std::endl;
    std::cout << "=================================" << std::endl;
    std::cout << "Results: " << testsPassed << " passed, " << testsFailed << " failed" << std::endl;
    std::cout << "=================================" << std::endl;

    return (testsFailed > 0) ? 1 : 0;
}
