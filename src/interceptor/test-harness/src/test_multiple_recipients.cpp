#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>
#include "../test_utils.h"

using namespace mapi_test;

int test_multiple_recipients() {
    std::cout << "\nTest: Multiple Recipients (TO, CC, BCC)" << std::endl;

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

    // Create message with multiple recipients
    char subject[] = "Test Email - Multiple Recipients";
    char body[] = "This email goes to multiple recipients.";

    // TO recipient
    char toName[] = "John Doe";
    char toAddress[] = "john@example.com";

    // CC recipient
    char ccName[] = "Jane Smith";
    char ccAddress[] = "jane@example.com";

    // BCC recipient
    char bccName[] = "Admin";
    char bccAddress[] = "admin@example.com";

    MapiRecipDesc recipients[3] = {};

    recipients[0].ulRecipClass = MAPI_TO;
    recipients[0].lpszName = toName;
    recipients[0].lpszAddress = toAddress;

    recipients[1].ulRecipClass = MAPI_CC;
    recipients[1].lpszName = ccName;
    recipients[1].lpszAddress = ccAddress;

    recipients[2].ulRecipClass = MAPI_BCC;
    recipients[2].lpszName = bccName;
    recipients[2].lpszAddress = bccAddress;

    MapiMessage message = {};
    message.lpszSubject = subject;
    message.lpszNoteText = body;
    message.nRecipCount = 3;
    message.lpRecips = recipients;
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
