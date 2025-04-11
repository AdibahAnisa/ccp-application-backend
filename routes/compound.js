import express from "express";
import client from "../utils/db.js";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { tokenMiddleware } from "../utils/authUtils.js";
import xml2js from "xml2js";
import { Builder } from "xml2js";

const compoundRouter = express.Router();

compoundRouter
  .get("/public", async (req, res) => {
    try {
      const compound = await client.compound.findMany();

      res.status(200).json(compound);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .get("/single/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const singleCompound = await client.compound.findUnique({
        where: { id },
      });

      res.status(200).json(singleCompound);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  });

compoundRouter.use(tokenMiddleware);

compoundRouter.post("/display", async (req, res) => {
  const { VehicleNo, NoticeNo } = req.body;
  const baseURL = process.env.COMPOUND_API;

  // If both are missing, then reject
  if (!VehicleNo && !NoticeNo) {
    return res
      .status(400)
      .json({ error: "At least VehicleNo or NoticeNo must be provided." });
  }

  // Build request payload dynamically
  const requestBody = {};
  if (VehicleNo) requestBody.VehicleNo = VehicleNo;
  if (NoticeNo) requestBody.NoticeNo = NoticeNo;

  try {
    const response = await axios.post(baseURL + "/SearchNotice", requestBody, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external API:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    }
    return res.status(500).json({ error: "Failed to fetch compound notice" });
  }
});

// compoundRouter.post("/display", async (req, res) => {
//   const userId = req.user.userId;

//   const agencyId = process.env.COMPOUND_AGENCY_ID;
//   const agencyKey = process.env.COMPOUND_AGENCY_KEY;
//   const soapHeader = process.env.COMPOUND_SOAP;

//   try {
//     // Query all plate numbers from the database using Prisma
//     const plates = await client.plateNumber.findMany({
//       where: {
//         userId: userId,
//       },
//       select: {
//         plateNumber: true,
//       },
//     });

//     if (plates.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No plate numbers found for this user" });
//     }

//     const plateNumbers = plates.map((plate) => plate.plateNumber);
//     let allSummonses = [];
//     let actionCode, responseCode, responseMessage;

//     for (const plateNumber of plateNumbers) {
//       const builder = new Builder();
//       const soapRequestJson = {
//         "s:Envelope": {
//           $: {
//             "xmlns:s": "http://schemas.xmlsoap.org/soap/envelope/",
//             "xmlns:a": "http://schemas.xmlsoap.org/ws/2004/08/addressing",
//           },
//           "s:Header": {
//             RequestCode: "REQ_11",
//             AgencyID: agencyId,
//             AgencyKey: agencyKey,
//           },
//           "s:Body": {
//             Request: {
//               OffenderIDNo: null,
//               VehicleRegistrationNumbers: {
//                 VehicleRegistrationNumber: plateNumber,
//               },
//               NoticeNo: null,
//             },
//           },
//         },
//       };

//       const soapRequest = builder.buildObject(soapRequestJson);
//       const response = await axios.post(process.env.COMPOUND_API, soapRequest, {
//         headers: {
//           "Content-Type": "text/xml",
//           SOAPAction: soapHeader,
//         },
//       });

//       await xml2js
//         .parseStringPromise(response.data, { explicitArray: false })
//         .then((result) => {
//           const envelope = result["s:Envelope"];
//           const body = envelope["s:Body"];
//           const responseContent = body?.Response;

//           if (!responseContent) {
//             return;
//           }

//           // Set actionCode, responseCode, and responseMessage from the first response
//           if (!actionCode && !responseCode && !responseMessage) {
//             actionCode = responseContent.ActionCode || null;
//             responseCode = responseContent.ResponseCode || null;
//             responseMessage = responseContent.ResponseMessage || null;
//           }

//           let summonses = responseContent.Summonses?.Summons || [];
//           if (!Array.isArray(summonses)) {
//             summonses = [summonses];
//           }

//           allSummonses = [
//             ...allSummonses,
//             ...summonses.map((summons) => ({
//               noticeNo: summons.NoticeNo || null,
//               vehicleRegistrationNo: summons.VehicleRegistrationNo || null,
//               offenceAct: summons.OffenceAct || null,
//               offenceSection: summons.OffenceSection || null,
//               offenceDescription: summons.OffenceDescription || null,
//               offenceLocation: summons.OffenceLocation || null,
//               offenceDate: summons.OffenceDate || null,
//               noticeStatus: summons.NoticeStatus || null,
//               amount: summons.Amount || null,
//             })),
//           ];
//         })
//         .catch((err) => {
//           console.error(
//             `Error parsing response for plate ${plateNumber}:`,
//             err,
//           );
//         });
//     }

//     if (allSummonses.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No summonses found for this user" });
//     }

//     const jsonResponse = {
//       success: true,
//       actionCode: actionCode || null,
//       responseCode: responseCode || null,
//       responseMessage: responseMessage || null,
//       summonses: allSummonses,
//     };

//     return res.status(200).json(jsonResponse);
//   } catch (error) {
//     console.error("Error during SOAP request:", error);
//     return res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// });

// compoundRouter.post("/search", async (req, res) => {
//   const { OffenderIDNo, VehicleRegistrationNumber, NoticeNo } = req.body;

//   const agencyId = process.env.COMPOUND_AGENCY_ID;
//   const agencyKey = process.env.COMPOUND_AGENCY_KEY;

//   // Build the SOAP request XML from the JSON input using xml2js.Builder
//   const builder = new Builder();
//   const soapRequestJson = {
//     "s:Envelope": {
//       $: {
//         "xmlns:s": "http://schemas.xmlsoap.org/soap/envelope/",
//         "xmlns:a": "http://schemas.xmlsoap.org/ws/2004/08/addressing",
//       },
//       "s:Header": {
//         RequestCode: "REQ_11",
//         AgencyID: agencyId,
//         AgencyKey: agencyKey,
//       },
//       "s:Body": {
//         Request: {
//           OffenderIDNo: OffenderIDNo, // Static value
//           VehicleRegistrationNumber: VehicleRegistrationNumber,
//           NoticeNo: NoticeNo,
//         },
//       },
//     },
//   };

//   const soapRequest = builder.buildObject(soapRequestJson);

//   const soapHeader = process.env.COMPOUND_SOAP;

//   try {
//     // Send SOAP request to the service using axios
//     const response = await axios.post(process.env.COMPOUND_API, soapRequest, {
//       headers: {
//         "Content-Type": "text/xml",
//         SOAPAction: soapHeader,
//       },
//     });

//     // Parse the SOAP XML response to JSON
//     xml2js.parseString(
//       response.data,
//       { explicitArray: false },
//       (err, result) => {
//         if (err) {
//           return res.status(500).json({
//             message: "Error parsing XML response",
//             error: err.message,
//           });
//         }

//         // Extract relevant data from the parsed JSON
//         const envelope = result["s:Envelope"];
//         const body = envelope["s:Body"];
//         const responseContent = body?.Response;

//         // If there's no response data
//         if (!responseContent) {
//           return res
//             .status(404)
//             .json({ message: "No data found in the response" });
//         }

//         // Extract the Summonses information
//         let summonses = responseContent.Summonses?.Summons || [];

//         // Check if summonses is an object and convert it to an array
//         if (!Array.isArray(summonses)) {
//           summonses = [summonses];
//         }

//         // Build JSON response to return
//         const jsonResponse = {
//           actionCode: responseContent.ActionCode || null,
//           responseCode: responseContent.ResponseCode || null,
//           responseMessage: responseContent.ResponseMessage || null,
//           summonses: summonses.map((summons) => ({
//             noticeNo: summons.NoticeNo || null,
//             vehicleRegistrationNo: summons.VehicleRegistrationNo || null,
//             offenceAct: summons.OffenceAct || null,
//             offenceSection: summons.OffenceSection || null,
//             offenceDescription: summons.OffenceDescription || null,
//             offenceLocation: summons.OffenceLocation || null,
//             offenceDate: summons.OffenceDate || null,
//             noticeStatus: summons.NoticeStatus || null,
//             amount: summons.Amount || null,
//           })),
//         };

//         // Return the response in JSON format
//         return res.status(200).json({ success: true, data: jsonResponse });
//       },
//     );
//   } catch (error) {
//     console.error("Error during SOAP request:", error);
//     return res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// });

// compoundRouter.post("/payCompound", async (req, res) => {
//   const {
//     OwnerIDNo,
//     OwnerCategoryID,
//     VehicleRegistrationNumber,
//     NoticeNo,
//     ReceiptNo,
//     PaymentTransactionType,
//     PaymentDate,
//     PaidAmount,
//     ChannelType,
//     PaymentStatus,
//     PaymentMode,
//     PaymentLocation,
//     Notes,
//   } = req.body;

//   const agencyId = process.env.COMPOUND_AGENCY_ID;
//   const agencyKey = process.env.COMPOUND_AGENCY_KEY;

//   if (isNaN(OwnerCategoryID)) {
//     return res
//       .status(400)
//       .json({ error: "Owner Category must be an integer." });
//   }

//   if (isNaN(PaymentTransactionType)) {
//     return res
//       .status(400)
//       .json({ error: "Payment Transaction Type must be an integer." });
//   }

//   if (isNaN(PaidAmount)) {
//     return res.status(400).json({ error: "Paid Amount must be an integer." });
//   }

//   // return req.body;

//   // Build the SOAP request XML from the JSON input using xml2js.Builder
//   const builder = new Builder();
//   const soapRequestJson = {
//     "s:Envelope": {
//       $: {
//         "xmlns:s": "http://schemas.xmlsoap.org/soap/envelope/",
//         "xmlns:a": "http://schemas.xmlsoap.org/ws/2004/08/addressing",
//       },
//       "s:Header": {
//         RequestCode: "REQ_12",
//         AgencyID: agencyId,
//         AgencyKey: agencyKey,
//       },
//       "s:Body": {
//         Request: {
//           OwnerIDNo: OwnerIDNo || null, // Static value
//           OwnerCategoryID: parseInt(OwnerCategoryID) || null,
//           VehicleRegistrationNumber: VehicleRegistrationNumber || null,
//           NoticeNo: NoticeNo,
//           ReceiptNo: ReceiptNo,
//           PaymentTransactionType: parseInt(PaymentTransactionType) || null,
//           PaymentDate: PaymentDate,
//           PaidAmount: parseInt(PaidAmount),
//           ChannelType: ChannelType || null,
//           PaymentStatus: PaymentStatus || null,
//           PaymentMode: PaymentMode || null,
//           PaymentLocation: PaymentLocation,
//           Notes: Notes || null,
//         },
//       },
//     },
//   };

//   const soapRequest = builder.buildObject(soapRequestJson);

//   const soapHeader = process.env.COMPOUND_SOAP;

//   try {
//     // Send SOAP request to the service using axios
//     const response = await axios.post(process.env.COMPOUND_API, soapRequest, {
//       headers: {
//         "Content-Type": "text/xml",
//         SOAPAction: soapHeader,
//       },
//     });

//     // Parse the SOAP XML response to JSON
//     xml2js.parseString(
//       response.data,
//       { explicitArray: false },
//       (err, result) => {
//         if (err) {
//           return res.status(500).json({
//             message: "Error parsing XML response",
//             error: err.message,
//           });
//         }

//         // Extract relevant data from the parsed JSON
//         const envelope = result["s:Envelope"];
//         const body = envelope["s:Body"];
//         const responseContent = body?.Response;

//         // If there's no response data
//         if (!responseContent) {
//           return res
//             .status(404)
//             .json({ message: "No data found in the response" });
//         }

//         let jsonResponse = {
//           actionCode: responseContent.ActionCode || null,
//           responseCode: responseContent.ResponseCode || null,
//           responseMessage: responseContent.ResponseMessage || null,
//         };

//         // Only add these fields if the ResponseCode is "200"
//         if (responseContent.ResponseCode === "200") {
//           jsonResponse.noticeNo = responseContent.NoticeNo || null;
//           jsonResponse.transactionId = responseContent.TransactionID || null;
//           jsonResponse.receiptNo = responseContent.ReceiptNo || null;
//         }

//         // Return the response in JSON format
//         return res.status(200).json({ success: true, data: jsonResponse });
//       },
//     );
//   } catch (error) {
//     console.error("Error during SOAP request:", error);
//     return res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// });

compoundRouter.post("/payCompound", async (req, res) => {
  const {
    NoticeNo,
    HandheldCode,
    OfficerID,
    ClampingPaidAmount,
    PaidAmount,
    PaymentMode,
  } = req.body;

  const baseURL = process.env.COMPOUND_API;

  // Build request payload dynamically
  const requestBody = {};
  if (NoticeNo) requestBody.NoticeNo = NoticeNo;
  if (HandheldCode) requestBody.HandheldCode = HandheldCode;
  if (OfficerID) requestBody.OfficerID = OfficerID;
  if (ClampingPaidAmount) requestBody.ClampingPaidAmount = ClampingPaidAmount;
  if (PaidAmount) requestBody.PaidAmount = PaidAmount;
  if (PaymentMode) requestBody.PaymentMode = PaymentMode;

  try {
    const response = await axios.post(
      baseURL + "/UpdateClamping",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external API:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    }
    return res.status(500).json({ error: "Failed to update compound notice" });
  }
});

compoundRouter.post("/store", async (req, res) => {
  const userId = req.user.userId; // Assuming this is obtained via authentication middleware
  const {
    OwnerIdNo,
    OwnerCategoryId,
    VehicleRegistrationNumber,
    NoticeNo,
    ReceiptNo,
    PaymentTransactionType,
    PaymentDate,
    PaidAmount,
    ChannelType,
    PaymentStatus,
    PaymentMode,
    PaymentLocation,
    Notes,
  } = req.body;
  const id = uuidv4(); // Generate unique ID

  if (isNaN(OwnerCategoryId)) {
    return res
      .status(400)
      .json({ error: "Owner Category must be an integer." });
  }

  if (isNaN(PaymentTransactionType)) {
    return res
      .status(400)
      .json({ error: "Payment Transaction Type must be an integer." });
  }

  try {
    // Create a new MonthlyPass
    const storeCompound = await client.compound.create({
      data: {
        id,
        userId,
        OwnerIdNo,
        OwnerCategoryId,
        VehicleRegistrationNumber,
        NoticeNo,
        ReceiptNo,
        PaymentTransactionType,
        PaymentDate,
        PaidAmount,
        ChannelType,
        PaymentStatus,
        PaymentMode,
        PaymentLocation,
        Notes,
      },
    });

    res.status(201).json({ status: "success", data: storeCompound });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default compoundRouter;
