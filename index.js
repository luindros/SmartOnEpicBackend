/**
 * @fileoverview FHIR Data Integration Service
 * Configuration and environment variables for EPIC FHIR integration
 */

import fs from 'fs'
import jose from 'node-jose'
import { randomUUID } from "crypto"
import axios from 'axios'
import hyperquest from 'hyperquest'
import ndjson from 'ndjson'
import nodemailer from 'nodemailer'
import schedule from 'node-schedule'

// Configuration constants
const CONFIG = {
  EPIC: {
    CLIENT_ID: "68c93063-8ca7-47be-8eec-862bee853de4",
    TOKEN_ENDPOINT: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
    FHIR_BASE_URL: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    GROUP_ID: "e3iabhmS8rsueyz7vaimuiaSmfGvi.QwjVXJANlPOgR83"
  },
  EMAIL: {
    FROM: '"Luis Iglesias" <luis@LIConsulting.com>',
    TO: "luis@LIConsulting.com"
  }
}

/**
 * Authentication Service for EPIC FHIR
 */
class AuthenticationService {
  /**
   * Creates a JWT token for authentication
   * @param {Object} payload - JWT payload
   * @returns {Promise<string>} Signed JWT
   */
  static async createJWTToken(payload) {
    const keystore = await this._loadKeystore()
    const key = keystore.get({use: 'sig'})
    return jose.JWS.createSign({compact: true, fields: {"typ": "jwt"}}, key)
      .update(JSON.stringify(payload))
      .final()
  }

  static async _loadKeystore() {
    const keyData = fs.readFileSync('keys.json')
    return await jose.JWK.asKeyStore(keyData.toString())
  }

  /**
   * Generates expiry timestamp
   * @param {number} minutes - Minutes until expiry
   * @returns {number} Unix timestamp
   */
  static generateExpiryTimestamp(minutes) {
    return Math.round((new Date().getTime() + minutes * 60 * 1000) / 1000)
  }

  /**
   * Requests access token from EPIC
   * @returns {Promise<Object>} Token response
   */
  static async requestAccessToken() {
    const jwt = await this.createJWTToken({
      "iss": CONFIG.EPIC.CLIENT_ID,
      "sub": CONFIG.EPIC.CLIENT_ID,
      "aud": CONFIG.EPIC.TOKEN_ENDPOINT,
      "jti": randomUUID(),
      "exp": this.generateExpiryTimestamp(4),
    })

    const formData = new URLSearchParams({
      'grant_type': 'client_credentials',
      'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      'client_assertion': jwt
    })

    const response = await axios.post(CONFIG.EPIC.TOKEN_ENDPOINT, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return response.data
  }
}

/**
 * FHIR Data Export Service
 */
class FHIRExportService {
  constructor(accessToken) {
    this.accessToken = accessToken
  }

  /**
   * Initiates bulk data export
   * @returns {Promise<string>} Content location URL
   */
  async initiateExport() {
    const response = await axios.get(
      `${CONFIG.EPIC.FHIR_BASE_URL}/Group/${CONFIG.EPIC.GROUP_ID}/$export`,
      {
        params: {
          _type: 'patient,observation',
          _typeFilter: 'Observation?category=laboratory',
        },
        headers: {
          Accept: 'application/fhir+json',
          Authorization: `Bearer ${this.accessToken}`,
          Prefer: 'respond-async'
        }
      }
    )
    return response.headers['content-location']
  }

  /**
   * Polls export status until completion
   * @param {string} url - Status endpoint URL
   * @param {number} pollInterval - Seconds between polls
   * @returns {Promise<Object>} Export data
   */
  async pollExportStatus(url, pollInterval = 30) {
    const checkStatus = async () => {
      try {
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        })
        console.log({
          status: response.status,
          progress: response.headers['x-progress'],
          timestamp: new Date().toISOString()
        })
        if (response.status === 200) return response.data
      } catch (error) {
        console.error("Export status check failed, retrying...")
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000))
      return checkStatus()
    }
    return checkStatus()
  }

  /**
   * Processes bulk response data
   * @param {Object} response - Bulk response object
   * @param {string} resourceType - FHIR resource type
   * @param {Function} processor - Processing callback
   */
  async processBulkData(response, resourceType, processor) {
    const outputs = response.output?.filter(output => output.type === resourceType)
    const streamProcessors = outputs?.map(output => 
      new Promise((resolve) => {
        const stream = hyperquest(output.url, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        })
        stream.pipe(ndjson.parse()).on('data', processor)
        stream.on('error', resolve)
        stream.on('end', resolve)
      })
    )
    return await Promise.all(streamProcessors)
  }
}

/**
 * Lab Results Analysis Service
 */
class LabAnalysisService {
  /**
   * Checks if an observation is within normal range
   * @param {Object} resource - FHIR Observation resource
   * @returns {Object} Analysis result
   */
  static checkIfObservationIsNormal(resource) {
    const value = resource?.valueQuantity?.value
    if (!resource?.referenceRange) {
      return {isNormal: false, reason: "No reference range found"}
    }
    const referenceRangeLow = resource?.referenceRange?.[0]?.low?.value
    const referenceRangeHigh = resource?.referenceRange?.[0]?.high?.value
    if (!value || !referenceRangeLow || !referenceRangeHigh) {
      return {isNormal: false, reason: "Incomplete data"}
    }
    if (value >= referenceRangeLow && value <= referenceRangeHigh) {
      return {isNormal: true, reason: "Within reference range"}
    } else {
      return {isNormal: false, reason: "Outside reference range"}
    }
  }
}

/**
 * Email Notification Service
 */
class NotificationService {
  static async sendLabReport(content) {
    try {
      // Create test account with ethereal
      //const testAccount = await nodemailer.createTestAccount();
     


      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
         // user: testAccount.user,
          //pass: testAccount.pass
            user: 'cheyanne.upton@ethereal.email',
            pass: 'zpgw8c5DkTb5TR8cKj'
        }
      });

      const info = await transporter.sendMail({
        from: '"Luis Iglesias" <luis@LIConsulting.com>',
        to:  "luis_recepient@LIConsulting.com>",
        subject: `Lab Reports on ${new Date().toDateString()}`,
        text: content
      });

      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      return info;
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }
}

/**
 * Main application
 */
async function main() {
  console.log("Initiating lab report generation process")
  
  // Authentication
  const tokenResponse = await AuthenticationService.requestAccessToken()
  
  // Export initialization
  const exportService = new FHIRExportService(tokenResponse.access_token)
  const contentLocation = await exportService.initiateExport()
  const bulkData = await exportService.pollExportStatus(contentLocation)

  // Data processing
  const patients = {}
  await exportService.processBulkData(bulkData, 'Patient', (resource) => {
    patients[`Patient/${resource.id}`] = resource
  })

  // Report generation
  let reportContent = `Lab Test Results Summary (Generated: ${new Date().toISOString()})\n`
  const abnormalResults = []
  const normalResults = []

  await exportService.processBulkData(bulkData, 'Observation', (resource) => {
    const {isNormal, reason} = LabAnalysisService.checkIfObservationIsNormal(resource)
    const patient = patients[resource.subject.reference]
    const resultEntry = `${resource.code.text}: ${resource?.valueQuantity?.value}. Reason: ${reason}, Patient: ${patient?.name?.[0]?.text} (ID: ${patient?.id})`
    
    if (isNormal) {
      normalResults.push(resultEntry)
    } else {
      abnormalResults.push(resultEntry)
    }
  })

  reportContent += '\nAbnormal Results:\n' + abnormalResults.join('\n')
  reportContent += '\n\nNormal Results:\n' + normalResults.join('\n')

  // Send notification
  const emailResult = await NotificationService.sendLabReport(reportContent)
  console.log("Report delivery status:", emailResult)
}

// Application entry point
main()
// Enable scheduling if needed:
schedule.scheduleJob('*/5 * * * *', main)