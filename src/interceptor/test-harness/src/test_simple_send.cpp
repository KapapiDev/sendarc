#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>
#include "../test_utils.h"

using namespace mapi_test;

int test_simple_send() {
    std::cout << "\nTest: Simple Send (basic email)" << std::endl;

    // Load the DLL
    HMODULE hDll = TestUtilities::LoadInterceptorDll();
    if (!hDll) {
        return 1;
    }

    MAPISendMailFunc MAPISendMail = reinterpret_cast<MAPISendMailFunc>(
        GetProcAddress(hDll, "MAPISendMail")
    );

    if (!MAPISendMail) {
        std::cerr << "Failed to get MAPISendMail function" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    // Create a simple message
    char subject[] = "Test Email - Simple Send";
    char body[] = "This is a test email from the SendArc test harness.";
    char toAddress[] = "test@example.com";
    char toName[] = "Test User";

    MapiRecipDesc recipient = {};
    recipient.ulRecipClass = MAPI_TO;
    recipient.lpszName = toName;
    recipient.lpszAddress = toAddress;

    MapiMessage message = {};
    message.lpszSubject = subject;
    message.lpszNoteText = body;
    message.nRecipCount = 1;
    message.lpRecips = &recipient;
    message.nFileCount = 0;
    message.lpFiles = nullptr;

    // Send the message
    ULONG result = MAPISendMail(0, 0, &message, 0, 0);

    std::cout << "MAPISendMail returned: " << result << std::endl;

    // Verify JSON file was created
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    bool success = TestUtilities::VerifyJsonFileCreated(tempDir);

    if (success) {
        std::string jsonPath = TestUtilities::GetNewestJsonPath(tempDir);
        success = !jsonPath.empty() && TestUtilities::ValidateJsonFile(jsonPath);
    }

    FreeLibrary(hDll);
    return success ? 0 : 1;
}
